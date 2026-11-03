/* Export-only compatibility for the running server's legacy crane rows.
 * No exam data or saved assessments are changed. Keep each variable-length grid,
 * carrying each surviving row's cells, height and moon anchors together.
 */
(function (global) {
  'use strict';
  const S='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const D='http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
  const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const P='http://schemas.openxmlformats.org/package/2006/relationships';
  const excluded=new Set(['行车抓渣','行车加料']);
  const nodes=(parent,ns,name)=>Array.from(parent.getElementsByTagNameNS(ns,name));
  const first=(parent,ns,name)=>nodes(parent,ns,name)[0];
  function parse(raw){
    if(/<!DOCTYPE/i.test(raw))throw new Error('Unsupported workbook XML');
    const doc=new DOMParser().parseFromString(raw,'application/xml');
    if(doc.getElementsByTagName('parsererror').length)throw new Error('Invalid workbook XML');
    return doc;
  }
  function serialize(doc){return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^?]*\?>\s*/, '');}
  function resolve(base,target){
    const parts=(target.startsWith('/')?target.slice(1):base.slice(0,base.lastIndexOf('/')+1)+target).split('/'),out=[];
    for(const part of parts){if(part==='..'){if(!out.length)throw new Error('Invalid workbook relationship');out.pop();}else if(part&&part!=='.')out.push(part);}
    return out.join('/');
  }
  const relPath=path=>path.replace(/([^/]+)$/,'_rels/$1.rels');
  async function read(zip,path){const part=zip.file(path);if(!part)throw new Error('Missing workbook part');return parse(await part.async('string'));}
  function content(cell,shared){
    if(!cell)return '';
    if(cell.getAttribute('t')==='s')return shared[Number(first(cell,S,'v')?.textContent)]||'';
    return first(cell,S,'is')?.textContent||first(cell,S,'v')?.textContent||'';
  }
  function clear(cell){while(cell.firstChild)cell.removeChild(cell.firstChild);cell.removeAttribute('t');}
  function put(cell,value){
    clear(cell);if(value===''||value===null||value===undefined)return;
    const doc=cell.ownerDocument;
    if(typeof value==='number'){const v=doc.createElementNS(S,'v');v.textContent=String(value);cell.appendChild(v);}
    else{cell.setAttribute('t','inlineStr');const is=doc.createElementNS(S,'is'),t=doc.createElementNS(S,'t');t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');t.textContent=value;is.appendChild(t);cell.appendChild(is);}
  }
  const cellMap=row=>new Map(nodes(row,S,'c').map(cell=>[cell.getAttribute('r').replace(/\d+$/,''),cell]));
  function relocate(row,number){row.setAttribute('r',String(number));for(const cell of nodes(row,S,'c'))cell.setAttribute('r',cell.getAttribute('r').replace(/\d+$/,String(number)));}
  function categoryLabels(doc,rows,shared,column,start,end){
    const labels=new Map();for(let n=start;n<=end;n++)labels.set(n,content(cellMap(rows.get(n)).get(column),shared));
    for(const merge of nodes(doc,S,'mergeCell')){
      const match=merge.getAttribute('ref').match(new RegExp('^'+column+'(\\d+):'+column+'(\\d+)$'));
      if(!match||+match[1]<start||+match[2]>end)continue;
      for(let n=+match[1];n<=+match[2];n++)labels.set(n,labels.get(+match[1]));
    }
    return labels;
  }
  function matrixBlocks(sheet){
    // Staff groups can repeat below one another. Locate their title and
    // original merged legend rather than assuming the skills end at row 18.
    const titles=[...sheet.rows.keys()].filter(n=>sheet.value(n,'A').split('\n')[0].trim().endsWith('能力矩阵'));
    const legends=nodes(sheet.doc,S,'mergeCell').map(node=>node.getAttribute('ref').match(/^F(\d+):H\1$/)).filter(Boolean).map(match=>+match[1]);
    return titles.map((number,index)=>{
      const next=titles[index+1]||Infinity;
      const legend=legends.find(n=>n>number+2&&n<next);
      if(!legend)return null;
      return {heading:sheet.value(number,'A').split('\n')[0].trim(),start:number+2,end:legend-1};
    }).filter(Boolean);
  }
  async function clean(input,JSZip){
    const zip=await JSZip.loadAsync(input,{checkCRC32:true});
    const workbook=await read(zip,'xl/workbook.xml'),relationships=await read(zip,'xl/_rels/workbook.xml.rels');
    const rels=new Map(nodes(relationships,P,'Relationship').filter(rel=>rel.getAttribute('TargetMode')!=='External').map(rel=>[rel.getAttribute('Id'),resolve('xl/workbook.xml',rel.getAttribute('Target'))]));
    let shared=[];
    if(zip.file('xl/sharedStrings.xml'))shared=nodes(await read(zip,'xl/sharedStrings.xml'),S,'si').map(node=>node.textContent);
    const sheets=[];
    for(const [index,spec] of nodes(workbook,S,'sheet').entries()){
      const path=rels.get(spec.getAttributeNS(R,'id'));if(!path)throw new Error('Missing worksheet relationship');
      const doc=await read(zip,path),rows=new Map(nodes(doc,S,'row').map(row=>[Number(row.getAttribute('r')),row]));
      const value=(row,col)=>content(rows.has(row)?cellMap(rows.get(row)).get(col):null,shared);
      const heading=value(1,'A').split('\n')[0].trim();
      sheets.push({index,path,doc,rows,value,heading,name:spec.getAttribute('name')});
    }
    // An item can repeat across employee pages. Count its original sequence
    // only once when renumbering later item pages of the same position.
    const removedByPosition=new Map();let changed=false;
    const blocks=sheets.flatMap(sheet=>matrixBlocks(sheet).map(block=>({...block,sheet})));
    for(const block of blocks){
      const {sheet,start,end,heading}=block;
      if(/\s行车工能力矩阵$/.test(heading))continue;
      const removed=new Set();
      for(let n=start;n<=end;n++)if(excluded.has(sheet.value(n,'D').split('\n')[0].trim()))removed.add(n);
      if(!removed.size)continue;
      if(!Array.from({length:end-start+1},(_,i)=>sheet.rows.has(i+start)).every(Boolean))throw new Error('Unexpected matrix export layout');
      block.removed=removed;
      let sequences=removedByPosition.get(heading);if(!sequences){sequences=new Set();removedByPosition.set(heading,sequences);}
      for(const n of removed){const seq=Number(sheet.value(n,'C'));if(Number.isInteger(seq)&&seq>0)sequences.add(seq);}
    }
    for(const block of blocks){
      const {sheet,start,end,heading}=block,sequences=removedByPosition.get(heading);if(!sequences)continue;
      const {doc,rows,path}=sheet,removed=block.removed||new Set(),capacity=end-start+1;
      const numbered=Array.from({length:capacity},(_,i)=>i+start).filter(n=>sheet.value(n,'D')&&!removed.has(n));
      const labels=Object.fromEntries(['A','B'].map(col=>[col,categoryLabels(doc,rows,shared,col,start,end)]));
      const rowMapping=new Map(),replacements=[],labelValues={A:[],B:[]};
      for(let offset=0;offset<capacity;offset++){
        const destination=offset+start,source=numbered[offset],row=rows.get(source||destination).cloneNode(true);
        relocate(row,destination);const cells=cellMap(row);
        if(source){
          rowMapping.set(source,destination);
          const original=Number(sheet.value(source,'C'));
          if(Number.isInteger(original)&&original>0)put(cells.get('C'),original-[...sequences].filter(n=>n<original).length);
        }else for(const cell of cells.values())clear(cell);
        for(const col of ['A','B']){labelValues[col].push(source?labels[col].get(source):'');clear(cells.get(col));}
        replacements.push(row);
      }
      for(let i=0;i<capacity;i++){
        rows.get(i+start).parentNode.replaceChild(replacements[i],rows.get(i+start));
        rows.set(i+start,replacements[i]);
      }
      const merges=first(doc,S,'mergeCells');if(!merges)throw new Error('Missing matrix merge grid');
      for(const merge of nodes(merges,S,'mergeCell')){
        const match=merge.getAttribute('ref').match(/^([AB])(\d+):\1(\d+)$/);
        if(match&&+match[2]>=start&&+match[3]<=end)merges.removeChild(merge);
      }
      for(const col of ['A','B']){
        for(let offset=0;offset<capacity;){let last=offset;while(last+1<capacity&&labelValues[col][last+1]===labelValues[col][offset])last++;
          put(cellMap(replacements[offset]).get(col),labelValues[col][offset]);
          if(last>offset){const merge=doc.createElementNS(S,'mergeCell');merge.setAttribute('ref',`${col}${offset+start}:${col}${last+start}`);merges.appendChild(merge);}
          offset=last+1;
        }
      }
      merges.setAttribute('count',String(nodes(merges,S,'mergeCell').length));
      const drawing=first(doc,S,'drawing');
      if(drawing){
        const relDoc=await read(zip,relPath(path)),rid=drawing.getAttributeNS(R,'id');
        const rel=nodes(relDoc,P,'Relationship').find(rel=>rel.getAttribute('Id')===rid&&rel.getAttribute('TargetMode')!=='External');
        if(!rel)throw new Error('Missing matrix drawing');
        const drawingPath=resolve(path,rel.getAttribute('Target')),drawingDoc=await read(zip,drawingPath);
        for(const anchor of nodes(drawingDoc,D,'oneCellAnchor')){
          const from=first(anchor,D,'from'),rowNode=first(from,D,'row'),colNode=first(from,D,'col');
          const source=Number(rowNode.textContent)+1,col=Number(colNode.textContent);
          if(source<start||source>end||col<4||col>13)continue;
          if(!rowMapping.has(source))anchor.parentNode.removeChild(anchor);else rowNode.textContent=String(rowMapping.get(source)-1);
        }
        zip.file(drawingPath,serialize(drawingDoc),{createFolders:false});
      }
      zip.file(path,serialize(doc),{createFolders:false});changed=true;
    }
    // The full-workshop download also includes a filterable evidence register.
    // Keep that register consistent without touching the five-level legend.
    for(const sheet of sheets){
      if(sheet.value(1,'B')!=='岗位'||sheet.value(1,'F')!=='作业项目')continue;
      const removed=[...sheet.rows.keys()].filter(n=>n>1&&sheet.value(n,'B').trim()!=='行车工'&&excluded.has(sheet.value(n,'F').trim()));
      if(!removed.length)continue;
      const removeSet=new Set(removed),data=first(sheet.doc,S,'sheetData');let number=0;
      for(const [old,row] of sheet.rows){if(removeSet.has(old)){data.removeChild(row);continue;}relocate(row,++number);}
      for(const node of [...nodes(sheet.doc,S,'autoFilter'),...nodes(sheet.doc,S,'dimension')])node.setAttribute('ref',node.getAttribute('ref').replace(/\d+$/,String(number)));
      for(const defined of nodes(workbook,S,'definedName'))if(defined.getAttribute('name')==='_xlnm.Print_Area'&&Number(defined.getAttribute('localSheetId'))===sheet.index)defined.textContent=defined.textContent.replace(/\d+$/,String(number));
      zip.file(sheet.path,serialize(sheet.doc),{createFolders:false});zip.file('xl/workbook.xml',serialize(workbook),{createFolders:false});changed=true;
    }
    // Return the exact input if it already obeys the position policy.
    return changed?zip.generateAsync({type:'uint8array',compression:'DEFLATE'}):input;
  }
  global.MatrixExportCleanup=Object.freeze({clean});
})(window);
