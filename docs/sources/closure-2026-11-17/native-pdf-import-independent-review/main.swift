import Foundation
import AppKit
import PDFKit
import NotebookCore
struct Failure: Error { let message: String }
var results:[[String:Any]]=[]
func require(_ ok:Bool,_ message:String)throws{if !ok{throw Failure(message:message)}}
func check(_ name:String,_ body:()throws->Void){do{try body();results.append(["name":name,"passed":true])}catch{results.append(["name":name,"passed":false,"error":String(describing:error)])}}
func reject(_ body:()throws->Void)throws{var rejected=false;do{try body()}catch{rejected=true};try require(rejected,"unexpected acceptance")}
let folder=URL(fileURLWithPath:CommandLine.arguments[1],isDirectory:true)
func fixture(_ name:String)throws->Data{try Data(contentsOf:folder.appendingPathComponent("fixtures/"+name))}
let asset=try NotebookPDFAsset(data:fixture("rotation-0.pdf"))
let imported=try NotebookPDFImport.appending(asset,to:Notebook(),title:"Independent")
let encoded=try NotebookCodec.encode(imported)
check("schema1 canonical output and editable identity remain stable"){
 let n=Notebook(title:"original");let e=try NotebookCodec.encode(n),d=try NotebookCodec.decode(e),j=try JSONSerialization.jsonObject(with:e) as! [String:Any]
 try require(n==d && j["pdfAssets"]==nil,"legacy changed");try require((j["pages"] as! [[String:Any]])[0]["background"]==nil,"legacy background invented")
}
check("18 forged schema/reference/payload countercases reject"){
 let base=try JSONSerialization.jsonObject(with:encoded) as! [String:Any]
 for k in 0..<18{
  var s=base,pages=s["pages"] as! [[String:Any]],assets=s["pdfAssets"] as! [[String:Any]],ref=pages[1]["background"] as! [String:Any]
  switch k{
  case 0:s["schemaVersion"]=true
  case 1:s["schemaVersion"]=2.5
  case 2:s["schemaVersion"]="2"
  case 3:s["schemaVersion"]=1
  case 4:s["future"]=[]
  case 5:ref["pageIndex"] = -1;pages[1]["background"]=ref;s["pages"]=pages
  case 6:ref["pageIndex"] = 1;pages[1]["background"]=ref;s["pages"]=pages
  case 7:ref["pageIndex"] = true;pages[1]["background"]=ref;s["pages"]=pages
  case 8:ref["assetDigest"] = "missing";pages[1]["background"]=ref;s["pages"]=pages
  case 9:ref["future"] = 7;pages[1]["background"]=ref;s["pages"]=pages
  case 10:pages[1]["background"]=NSNull();s["pages"]=pages
  case 11:assets[0]["digest"]=String(repeating:"f",count:64);s["pdfAssets"]=assets
  case 12:assets[0]["data"]="%%%";s["pdfAssets"]=assets
  case 13:assets[0]["future"]=true;s["pdfAssets"]=assets
  case 14:s["pdfAssets"]=assets+assets
  case 15:s["pages"]=[pages[0]]
  case 16:pages[1]["id"]=pages[0]["id"];s["pages"]=pages
  default:s["pdfAssets"]=[]
  }
  try reject{_ = try NotebookCodec.decode(JSONSerialization.data(withJSONObject:s))}
 }
}
check("64 total pages accepted exactly;65 refused without mutation"){
 let n=Notebook(pages:(0..<63).map{NotebookPage(title:"\($0)")}),full=try NotebookPDFImport.appending(asset,to:n,title:"boundary")
 try require(full.pages.count==64,"64 rejected");let before=try NotebookCodec.encode(full)
 try reject{_ = try NotebookPDFImport.appending(asset,to:full,title:"65")};try require(try NotebookCodec.encode(full)==before,"source mutated")
}
check("same bytes imported twice share one immutable asset"){
 let n=try NotebookPDFImport.appending(asset,to:imported,title:"again")
 try require(n.pdfAssets.count==1 && n.pages.count==3,"dedup failed");try require(n.pages[1].id != n.pages[2].id,"duplicate identity")
 let e=try NotebookCodec.encode(n);try require(e.count == NotebookCodec.encodedSize(n),"cached size mismatch")
 let d=try NotebookCodec.decode(e);try require(d.pdfAssets[0].data==asset.data && d==n,"roundtrip differs")
}
check("invalid PDF geometry rejects"){
 for f in ["invalid-rotation.pdf","no-intersection.pdf"]{try reject{_ = try NotebookPDFAsset(data:fixture(f))}}
}
check("original source bytes remain after invalid atomic write"){
 let url=folder.appendingPathComponent("preserved.ardesiaquaderno");try encoded.write(to:url)
 var bad=imported;bad.pages[1].background=PDFBackground(assetDigest:asset.digest,pageIndex:99)
 try reject{try NotebookCodec.write(bad,to:url)};try require(try Data(contentsOf:url)==encoded,"original overwritten")
}
func color(_ b:NSBitmapImageRep,_ x:Int,_ y:Int)->String{let c=b.colorAt(x:x,y:y)!.usingColorSpace(.deviceRGB)!;if c.redComponent > 0.8 && c.greenComponent > 0.8 && c.blueComponent > 0.8{return "white"};if c.redComponent > 0.8 && c.blueComponent > 0.8{return "magenta"};if c.redComponent > 0.8 && c.greenComponent > 0.8{return "yellow"};if c.redComponent > 0.8{return "red"};if c.greenComponent > 0.8{return "green"};if c.blueComponent > 0.8{return "blue"};return "other"}
for angle in [0,90,180,270,-90,450]{check("inherited offset crop+rotation \(angle),vector text and clipped margins"){
 let a=try NotebookPDFAsset(data:fixture("rotation-\(angle).pdf")),n=try NotebookPDFImport.appending(a,to:Notebook(),title:"geometry"),e=try NotebookPDF.render(n),p=PDFDocument(data:e)!.page(at:1)!
 try require(p.string?.contains("INDEPENDENT")==true,"vector text missing")
 let b=NSBitmapImageRep(data:p.thumbnail(of:NSSize(width:595,height:842),for:.mediaBox).tiffRepresentation!)!
 let normalized=(angle%360+360)%360,odd=normalized%180==90,dx=odd ? 70:149,dy=odd ? 210:50
 let expected=[0:["blue","yellow","red","green"],90:["red","blue","green","yellow"],180:["green","red","yellow","blue"],270:["yellow","green","blue","red"]][normalized]!
 let points=[(297-dx,421-dy),(297+dx,421-dy),(297-dx,421+dy),(297+dx,421+dy)]
 for(i,xy)in points.enumerated(){try require(color(b,xy.0,xy.1)==expected[i],"quadrant \(i) was \(color(b,xy.0,xy.1)) expected \(expected[i])")}
 // Source paints outside CropBox magenta: inspect the actual letterbox next to crop.
 try require(color(b,odd ? 100:297,odd ? 421:300)=="white","outside-crop paint escaped")
 try b.representation(using:.png,properties:[:])!.write(to:folder.appendingPathComponent("geometry-\(angle).png"))
}}
check("partially out-of-media CropBox uses visible intersection"){
 let a=try NotebookPDFAsset(data:fixture("partial-crop.pdf")),n=try NotebookPDFImport.appending(a,to:Notebook(),title:"partial"),e=try NotebookPDF.render(n),p=PDFDocument(data:e)!.page(at:1)!
 let b=NSBitmapImageRep(data:p.thumbnail(of:NSSize(width:595,height:842),for:.mediaBox).tiffRepresentation!)!
 try b.representation(using:.png,properties:[:])!.write(to:folder.appendingPathComponent("partial-crop.png"))
 try require(color(b,148,371)=="blue" && color(b,446,471)=="green","effective crop content placement wrong")
 try require(color(b,297,300)=="white","effective crop letterbox wrong")
}
let out=try JSONSerialization.data(withJSONObject:["checks":results,"passed":results.filter{$0["passed"] as? Bool == true}.count,"failed":results.filter{$0["passed"] as? Bool == false}.count],options:[.prettyPrinted,.sortedKeys]);try out.write(to:folder.appendingPathComponent("countercases.json"));print(String(data:out,encoding:.utf8)!);exit(results.contains{$0["passed"] as? Bool == false} ? 1:0)
