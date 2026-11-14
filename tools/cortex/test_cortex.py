import hashlib
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import cortex


class CortexTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.git("init", "-q")
        self.git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-qm", "fixture")
        self.db = cortex.connect(self.root / "memory.sqlite3", self.repo)

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def git(self, *args):
        return subprocess.run(["git", "-C", str(self.repo), *args], check=True, capture_output=True)

    def file(self, path, text, tracked=True):
        target = self.repo / path
        target.parent.mkdir(exist_ok=True, parents=True)
        target.write_text(text, encoding="utf-8")
        if tracked:
            self.git("add", "--", path)
        return target

    def search(self, text, **kw):
        return cortex.search(self.db, self.repo, text, **kw)

    def test_repository_fsmonitor_is_never_executed(self):
        self.file("src/example.ts", "pressure\n")
        hook = self.repo / "monitor.sh"
        hook.write_text('#!/bin/sh\nprintf executed > "$PWD/monitor-executed"\n')
        hook.chmod(0o700)
        self.git("config", "core.fsmonitor", str(hook))
        self.assertTrue(self.search("pressure")["results"])
        self.assertFalse((self.repo / "monitor-executed").exists())

    def test_provenance_budget_and_lines(self):
        content = "intro\npressure controls and piston\n" * 60
        self.file("src/fluid.ts", content)
        result = self.search("pressure piston", budget_bytes=1500)
        self.assertTrue(result["results"])
        self.assertLessEqual(result["evidence_bytes"], 1500)
        self.assertEqual(result["evidence_bytes"], sum(len(cortex.evidence_text(x).encode()) for x in result["results"]))
        for evidence in result["results"]:
            self.assertEqual(evidence["sha256"], hashlib.sha256(content.encode()).hexdigest())
            self.assertEqual(evidence["body"], "".join(content.splitlines(keepends=True)[evidence["start"]-1:evidence["end"]]))

    def test_incremental_reuses_chunks_and_invalidates_same_size_mtime(self):
        path = self.file("a.ts", "oldvalue\n")
        cortex.refresh(self.db, self.repo)
        before = path.stat()
        unchanged = cortex.refresh(self.db, self.repo)
        self.assertEqual((unchanged["updated"], unchanged["unchanged"]), (0, 1))
        path.write_text("newvalue\n")
        os.utime(path, ns=(before.st_atime_ns, before.st_mtime_ns))
        self.assertFalse(self.search("oldvalue")["results"])
        self.assertTrue(self.search("newvalue")["results"])

    def test_deleted_file_removed(self):
        path = self.file("a.ts", "obsolete\n")
        self.assertTrue(self.search("obsolete")["results"])
        path.unlink()
        result = self.search("obsolete")
        self.assertFalse(result["results"])
        self.assertEqual(result["index"]["removed"], 1)

    def test_new_secret_invalidates_old_index(self):
        path = self.file("config.ts", "ordinarycontent\n")
        self.search("ordinarycontent")
        path.write_text('const api_key = "unmistakably_private_credential_99281";\n')
        result = self.search("ordinarycontent")
        self.assertFalse(result["results"])
        self.assertEqual(result["index"]["files"], 0)

    def test_untracked_binary_and_named_secrets_excluded(self):
        self.file("untracked.ts", "needle", tracked=False)
        self.file("credentials.json", '{"needle": true}')
        self.file(".env.production", "needle")
        self.file("binary.ts", "needle\x00")
        self.file("key.md", "-----BEGIN PRIVATE KEY-----\nneedle")
        self.assertEqual(self.search("needle")["index"]["files"], 0)

    def test_json_credentials_are_excluded(self):
        self.file("config.json", '{"api_key": "long_private_credential", "needle": true}')
        self.assertFalse(self.search("needle")["results"])

    def test_file_symlink_not_followed_even_after_index(self):
        path = self.file("src/a.ts", "oldcontent")
        self.search("oldcontent")
        outside = self.root / "outside.ts"
        outside.write_text("secretoutside")
        path.unlink()
        path.symlink_to(outside)
        self.assertFalse(self.search("oldcontent secretoutside")["results"])

    def test_parent_symlink_not_followed(self):
        path = self.file("src/a.ts", "oldcontent")
        outside = self.root / "outside"
        outside.mkdir()
        (outside / "a.ts").write_text("secretoutside")
        path.unlink()
        path.parent.rmdir()
        path.parent.symlink_to(outside, target_is_directory=True)
        self.assertFalse(self.search("secretoutside")["results"])

    def test_literal_fts_syntax_is_data(self):
        self.file("a.ts", "visible evidence")
        result = self.search('visible" OR * NOT (DROP TABLE files); --')
        self.assertTrue(result["results"])
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM files").fetchone()[0], 1)

    def test_scope_mismatch_fails(self):
        other = self.root / "other"
        other.mkdir()
        with self.assertRaisesRegex(ValueError, "repo mismatch"):
            cortex.connect(self.root / "memory.sqlite3", other)

    def test_byte_limit_rolls_back_incremental_transaction(self):
        path = self.file("a.ts", "original")
        before = cortex.refresh(self.db, self.repo)
        path.write_text("changed")
        self.file("z.ts", "x" * 100)
        with patch.object(cortex, "MAX_TOTAL_BYTES", 20):
            with self.assertRaisesRegex(ValueError, "rolled back"):
                cortex.refresh(self.db, self.repo)
        self.assertEqual(self.db.execute("SELECT value FROM meta WHERE key='manifest'").fetchone()[0], before["manifest_sha256"])
        self.assertEqual(self.db.execute("SELECT body FROM evidence").fetchone()[0], "original")

    def test_non_utf8_and_oversized_files_not_indexed(self):
        path = self.file("a.ts", "visible")
        path.write_bytes(b"\xff")
        self.file("b.ts", "x" * (cortex.MAX_FILE_BYTES + 1))
        self.assertFalse(self.search("visible")["results"])

    def test_source_changed_between_refresh_and_return_fails(self):
        self.file("a.ts", "visible")
        original = cortex.read_source
        calls = 0
        def moving(repo, path):
            nonlocal calls
            calls += 1
            return original(repo, path) if calls == 1 else b"modified"
        with patch.object(cortex, "read_source", moving):
            with self.assertRaisesRegex(ValueError, "changed after indexing"):
                self.search("visible")

    def test_unicode_chunks_remain_bounded(self):
        text = "fisicaà" * 3000
        self.file("a.md", text)
        for _, _, chunk in cortex.chunks(text):
            self.assertLessEqual(len(chunk.encode()), cortex.CHUNK_BYTES)
        self.assertEqual("".join(x[2] for x in cortex.chunks(text)), text)

    def test_bad_budget_and_empty_query_rejected(self):
        with self.assertRaises(ValueError):
            self.search("anything", budget_bytes=0)
        with self.assertRaises(ValueError):
            self.search("   ")

    def test_database_private_and_symlink_refused(self):
        self.assertEqual((self.root / "memory.sqlite3").stat().st_mode & 0o777, 0o600)
        link = self.root / "alias.sqlite3"
        link.symlink_to(self.root / "memory.sqlite3")
        with self.assertRaises(ValueError):
            cortex.connect(link, self.repo)

    def test_definition_survives_many_short_test_mentions(self):
        # New symbol, absent from the pilot: frequency must not consume the budget
        # before the actual declaration, even with more than the old120 candidates.
        for i in range(135):
            self.file(f"tests/case-{i}.test.ts", "verifyThermalBalance();\n" * 5)
        content = "// Context and assumptions\n" * 18 + "export function verifyThermalBalance(input) {\n  return input.left === input.right;\n}\n"
        self.file("src/thermodynamics.ts", content)
        result = self.search("verifyThermalBalance", budget_bytes=1500, limit=2)
        self.assertEqual(result["results"][0]["path"], "src/thermodynamics.ts")
        self.assertIn("export function verifyThermalBalance", result["results"][0]["body"])
        self.assertLessEqual(result["evidence_bytes"], 1500)

    def test_definition_hints_cover_python_types_and_constants(self):
        for path, declaration, symbol in [
            ("src/pressure.py", "async def compute_pressure(value):\n    return value\n", "compute_pressure"),
            ("src/units.ts", "export interface MeterReading { value: number }\n", "MeterReading"),
            ("src/energy.ts", "export const energyScale = 1000;\n", "energyScale"),
        ]:
            self.file(path, declaration)
            self.file("benchmark.py", f'queries = ["{symbol}", "{symbol}"]\n')
            result = self.search(symbol, budget_bytes=600, limit=1)
            self.assertEqual(result["results"][0]["path"], path)
            self.assertEqual(result["results"][0]["body"], declaration)

    def test_declaration_strings_are_not_hints(self):
        self.file("a.ts", 'const example = "export function resolveImpulse()";\n')
        self.file("z.ts", "export function resolveImpulse() { return 42; }\n")
        result = self.search("resolveImpulse", limit=1)
        self.assertEqual(result["results"][0]["path"], "z.ts")

    def test_italian_query_centers_real_evidence_not_benchmark_prompt(self):
        self.file("tools/benchmark.py", 'query = "pressione recipiente equilibrio"\n')
        content = "Introduzione e ipotesi.\n" * 31 + "La pressione del recipiente raggiunge equilibrio.\n" + "Dettagli sulle misure.\n" * 8
        self.file("docs/fluidi.md", content)
        result = self.search("pressione recipiente equilibrio", budget_bytes=500, limit=1)
        row = result["results"][0]
        self.assertEqual(row["path"], "docs/fluidi.md")
        self.assertIn("La pressione del recipiente raggiunge equilibrio.", row["body"])
        self.assertEqual(row["body"], "".join(content.splitlines(keepends=True)[row["start"]-1:row["end"]]))
        self.assertLessEqual(result["evidence_bytes"], 500)

    def test_accent_insensitive_query_focus_keeps_original_source_bytes(self):
        content = "Introduzione al modello.\n" * 30 + "La quantità si conserva nel sistema isolato.\n"
        self.file("docs/conservazione.md", content)
        result = self.search("quantita", budget_bytes=300, limit=1)
        row = result["results"][0]
        self.assertIn("quantità", row["body"])
        self.assertEqual(row["body"], "".join(content.splitlines(keepends=True)[row["start"]-1:row["end"]]))
        self.assertLessEqual(result["evidence_bytes"], 300)

    def test_multibyte_match_line_never_truncated_or_misnumbered(self):
        content = "à energia\n" * 32 + "Misura quantità e velocità osservabile.\n" + "ω μ\n" * 6
        self.file("docs/quantita.md", content)
        result = self.search("quantità velocità", budget_bytes=300)
        row = result["results"][0]
        self.assertIn("Misura quantità e velocità osservabile.", row["body"])
        self.assertEqual(row["body"], "".join(content.splitlines(keepends=True)[row["start"]-1:row["end"]]))
        self.assertLessEqual(result["evidence_bytes"], 300)

    def test_oversized_matching_line_is_omitted_not_fabricated(self):
        self.file("src/one.ts", "const veryLongScientificSymbol = '" + "x" * 3000 + "';\n")
        result = self.search("veryLongScientificSymbol", budget_bytes=500)
        self.assertFalse(result["results"])
        self.assertEqual(result["evidence_bytes"], 0)

    def test_repeated_split_line_never_appears_as_duplicate_evidence(self):
        self.file("doc.md", "pressure " * 120 + "\n")
        result = self.search("pressure", budget_bytes=8000)
        self.assertEqual(len(result["results"]), 1)
        self.assertEqual((result["results"][0]["start"], result["results"][0]["end"]), (1, 1))



if __name__ == "__main__":
    unittest.main(verbosity=2)
