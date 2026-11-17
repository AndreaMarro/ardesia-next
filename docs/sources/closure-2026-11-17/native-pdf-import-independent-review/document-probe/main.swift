import AppKit
import Foundation
import NotebookCore
struct Failure:Error{let message:String}
func expect(_ yes:Bool,_ message:String)throws{if !yes{throw Failure(message:message)}}
func rejects(_ body:()throws->Void)throws{var threw=false;do{try body()}catch{threw=true};try expect(threw,"expected rejection")}
var checks:[[String:Any]]=[]
func test(_ name:String,_ body:()throws->Void){do{try body();checks.append(["name":name,"passed":true])}catch{checks.append(["name":name,"passed":false,"error":String(describing:error)])}}
let app=NSApplication.shared
let out=URL(fileURLWithPath:CommandLine.arguments[1],isDirectory:true)
let asset=try NotebookPDFAsset.read(out.appendingPathComponent("fixtures/rotation-0.pdf"))
test("actual NSDocument import is one undo group;redo restores exact IDs and bytes"){
 let d=NotebookDocument(),before=d.notebook
 try d.importPDFAsset(asset,title:"import");let after=d.notebook
 try expect(after.pages.count==2 && after.pdfAssets.count==1 && d.selectedPageID==after.pages[1].id,"import state")
 d.undoDrawing(nil);try expect(d.notebook==before && d.selectedPageID==before.pages[0].id,"undo failed")
 d.redoDrawing(nil);try expect(d.notebook==after,"redo failed")
 try expect(d.notebook.pdfAssets[0].data==asset.data,"source changed")
}
test("duplicate/reorder/delete last reference prune atomically and undo restores original"){
 let d=NotebookDocument();try d.importPDFAsset(asset,title:"import");let id=d.page.id
 d.duplicatePage();try expect(d.notebook.pages.count==3 && d.notebook.pdfAssets.count==1 && d.page.id != id,"duplicate duplicated bytes/identity")
 d.movePage(-1);try expect(d.page.background?.assetDigest==asset.digest,"move detached reference")
 d.removePage();try expect(d.notebook.pages.count==2 && d.notebook.pdfAssets.count==1,"premature prune")
 d.selectPage(id);let before=d.notebook;d.removePage();try expect(d.notebook.pages.count==1 && d.notebook.pdfAssets.isEmpty,"last reference not pruned")
 d.undoDrawing(nil);try expect(d.notebook==before,"undo failed to restore source and page")
 d.redoDrawing(nil);try expect(d.notebook.pdfAssets.isEmpty,"redo failed to prune")
 _ = try NotebookCodec.decode(NotebookCodec.encode(d.notebook))
}
test("failed full-document import preserves model,selected page and undo action"){
 let d=NotebookDocument();d.edit("Fill"){n in n.pages=(0..<64).map{NotebookPage(title:"\($0)")}}
 let before=try NotebookCodec.encode(d.notebook),selection=d.selectedPageID,action=d.undoManager!.undoActionName
 try rejects{try d.importPDFAsset(asset,title:"overflow")}
 try expect(try NotebookCodec.encode(d.notebook)==before,"mutated on failure")
 try expect(d.selectedPageID==selection && d.undoManager!.undoActionName==action,"selection/history changed")
 d.undoDrawing(nil);try expect(d.notebook.pages.count==1 && d.notebook.schemaVersion==1,"prior undo lost")
}
test("12MiB boundary accepted and +1 byte rejected before parser"){
 let exact=try NotebookPDFAsset.read(out.appendingPathComponent("fixtures/exact-12MiB.pdf"))
 try expect(exact.data.count==12*1024*1024,"boundary fixture wrong")
 try rejects{_ = try NotebookPDFAsset.read(out.appendingPathComponent("fixtures/over-12MiB.pdf"))}
}
test("32MiB canonical size,dedup at limit and import failure preserve model/history"){
 let exact=try NotebookPDFAsset.read(out.appendingPathComponent("fixtures/exact-12MiB.pdf"));var otherData=exact.data
 // Change one harmless comment byte, preserving valid PDF offsets and size.
 let comment=otherData.range(of:Data(repeating:120,count:100))!;otherData[comment.lowerBound]=121
 let other=try NotebookPDFAsset(data:otherData),d=NotebookDocument()
 try d.importPDFAsset(exact,title:"large");try d.importPDFAsset(exact,title:"same")
 try expect(d.notebook.pdfAssets.count==1 && d.notebook.pages.count==3,"dedup failed")
 let before=try NotebookCodec.encode(d.notebook),action=d.undoManager!.undoActionName,selection=d.selectedPageID
 try expect(before.count==NotebookCodec.encodedSize(d.notebook) && before.count<=32*1024*1024,"wrong cached byte count")
 try rejects{try d.importPDFAsset(other,title:"would exceed32MiB")}
 try expect(try NotebookCodec.encode(d.notebook)==before,"model changed on32MiB rejection")
 try expect(d.undoManager!.undoActionName==action && d.selectedPageID==selection,"history/selection changed")
 d.undoDrawing(nil);try expect(d.notebook.pages.count==2 && d.notebook.pdfAssets.count==1,"undo repeatimport wrong")
 d.undoDrawing(nil);try expect(d.notebook.pages.count==1 && d.notebook.pdfAssets.isEmpty,"undo firstimport wrong")
}
let report:[String:Any]=["checks":checks,"passed":checks.filter{$0["passed"]as?Bool==true}.count,"failed":checks.filter{$0["passed"]as?Bool==false}.count]
let data=try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]);try data.write(to:out.appendingPathComponent("document-and-boundaries.json"));print(String(data:data,encoding:.utf8)!);exit(checks.contains{$0["passed"]as?Bool==false} ? 1:0)
