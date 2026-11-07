import {CoreError, canonicalJson, materialPage, type MaterialData, type MaterialState} from '@ardesia/contracts';

export function validateMaterialReference(state: MaterialState, documentId: string, data: MaterialData): void {
  if (state.status !== 'ready' || state.manifest.documentId !== documentId
    || canonicalJson(materialPage(state.manifest, data.page)) !== canonicalJson(data)) {
    throw new CoreError('INVALID_REFERENCE', 'The page must reference an exact, verified material in this lesson.');
  }
}
