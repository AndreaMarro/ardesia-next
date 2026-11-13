/** Isolated proposal for an ephemeral training demo. Not a ministry comparator. */
export type ParsedTrainingNumber = {kind:'blank'} | {kind:'invalid';reason:string} | {kind:'number';numerator:bigint;denominator:bigint};
export type TrainingKey = {kind:'choice';correctOptionId:string;optionIds:readonly string[]} | {kind:'number';exact:string};
export type TrainingResult = {kind:'correct'|'wrong'|'invalid'|'blank';pointsTenths:number;reason?:string};
const INVALID_FORMAT='Usa un numero, un decimale o una frazione nell’unità indicata, senza scrivere l’unità. Punto e virgola sono separatori decimali; non usare separatori delle migliaia.';
const INVALID_LIMIT='Usa al massimo 24 cifre per numero ed esponenti compresi tra −12 e 12.';

function decimalPart(text:string):{numerator:bigint;denominator:bigint}|string{
 const match=/^([+-]?)(?:(\d+)(?:[.,](\d+))?|[.,](\d+))(?:[eE]([+-]?\d{1,2}))?$/.exec(text);
 if(!match)return INVALID_FORMAT;
 const fraction=match[3]??match[4]??'',digits=(match[2]??'0')+fraction,exponent=Number(match[5]??0);
 if(digits.length>24||Math.abs(exponent)>12)return INVALID_LIMIT;
 let numerator=BigInt(digits)*(match[1]==='-'?-1n:1n),denominator=10n**BigInt(fraction.length);
 if(exponent>=0)numerator*=10n**BigInt(exponent);else denominator*=10n**BigInt(-exponent);
 return {numerator,denominator};
}
export function parseTrainingNumber(raw:string):ParsedTrainingNumber{
 const text=raw.trim().replaceAll('−','-');
 if(!text)return {kind:'blank'};
 if(text.length>96)return {kind:'invalid',reason:INVALID_LIMIT};
 const pieces=text.split('/');if(pieces.length>2)return {kind:'invalid',reason:INVALID_FORMAT};
 const first=decimalPart(pieces[0]!.trim());if(typeof first==='string')return {kind:'invalid',reason:first};
 let {numerator,denominator}=first;
 if(pieces.length===2){
  const second=decimalPart(pieces[1]!.trim());if(typeof second==='string')return {kind:'invalid',reason:second};
  if(second.numerator===0n)return {kind:'invalid',reason:'Il denominatore della frazione non può essere zero.'};
  numerator*=second.denominator;denominator*=second.numerator;
 }
 if(denominator<0n){numerator=-numerator;denominator=-denominator;}
 return {kind:'number',numerator,denominator};
}
export function gradeTrainingAnswer(key:TrainingKey,raw:string):TrainingResult{
 let correct:boolean;
 if(key.kind==='choice'){
  if(key.optionIds.length!==5||new Set(key.optionIds).size!==5||!key.optionIds.includes(key.correctOptionId))throw Error('Invalid training key');
  if(!raw.trim())return {kind:'blank',pointsTenths:0};
  if(!key.optionIds.includes(raw))return {kind:'invalid',pointsTenths:-1,reason:'Alternativa non riconosciuta.'};
  correct=raw===key.correctOptionId;
 }else{
  const expected=parseTrainingNumber(key.exact);if(expected.kind!=='number')throw Error('Invalid exact training key');
  const actual=parseTrainingNumber(raw);
  if(actual.kind==='invalid')return {kind:'invalid',pointsTenths:-1,reason:actual.reason};
  if(actual.kind==='blank')return {kind:'blank',pointsTenths:0};
  correct=actual.numerator*expected.denominator===expected.numerator*actual.denominator;
 }
 return {kind:correct?'correct':'wrong',pointsTenths:correct?10:-1};
}
