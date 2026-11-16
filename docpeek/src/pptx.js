/* Docpeek - Keynote -> PowerPoint (.pptx). Pure JS, uses fflate's zipSync.
 * Each Keynote slide becomes an editable PowerPoint slide: title, bullet points,
 * up to two pictures, presenter notes, and "skipped" kept as hidden.
 * Slides that have no text but have a thumbnail get the thumbnail as a full-slide picture. */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
const enc = (s) => new TextEncoder().encode(s);
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const W = 12192000, H = 6858000; // 16:9
const EMU = 12700; // per point

/** Width/height of PNG, JPEG or GIF bytes; null for anything else. */
export function imageSize(b) {
  if (!b || b.length < 24) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const dv = new DataView(b.buffer, b.byteOffset); return { w: dv.getUint32(16), h: dv.getUint32(20), ext: 'png' };
  }
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8), ext: 'gif' };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = (b[i + 2] << 8) | b[i + 3];
      if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
        return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8], ext: 'jpeg' };
      }
      i += 2 + len;
    }
  }
  return null;
}

const fit = (iw, ih, bx, by, bw, bh) => {
  const s = Math.min(bw / iw, bh / ih);
  const w = Math.round(iw * s), h = Math.round(ih * s);
  return { x: bx + Math.round((bw - w) / 2), y: by + Math.round((bh - h) / 2), w, h };
};

function paras(lines, size, bullet) {
  if (!lines.length) return `<a:p><a:endParaRPr lang="ja-JP" sz="${size}"/></a:p>`;
  return lines.map((l) => `<a:p>${bullet ? '<a:pPr marL="285750" indent="-285750"><a:buFont typeface="Arial"/><a:buChar char="•"/></a:pPr>' : '<a:pPr><a:buNone/></a:pPr>'}<a:r><a:rPr lang="ja-JP" sz="${size}" dirty="0"/><a:t>${esc(l)}</a:t></a:r></a:p>`).join('');
}
function textShape(id, name, ph, x, y, w, h, body, size, bullet, anchor = 't') {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="${ph ? 0 : 1}"/><p:nvPr>${ph || ''}</p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="${anchor}"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paras(body, size, bullet)}</p:txBody></p:sp>`;
}
function tableShape(id, rows, x, y, w, h) {
  const nc = Math.max(1, ...rows.map((r) => r.length));
  const colW = Math.floor(w / nc), rowH = Math.max(250000, Math.min(500000, Math.floor(h / Math.max(1, rows.length))));
  const sz = rows.length > 12 || nc > 6 ? 1000 : 1400;
  const grid = Array.from({ length: nc }, () => `<a:gridCol w="${colW}"/>`).join('');
  const trs = rows.map((r, ri) => `<a:tr h="${rowH}">${Array.from({ length: nc }, (_, ci) => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="ja-JP" sz="${sz}"${ri === 0 ? ' b="1"' : ''} dirty="0"/><a:t>${esc(r[ci] ?? '')}</a:t></a:r></a:p></a:txBody><a:tcPr><a:lnL w="6350"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:lnL><a:lnR w="6350"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:lnR><a:lnT w="6350"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:lnT><a:lnB w="6350"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:lnB>${ri === 0 ? '<a:solidFill><a:srgbClr val="F2F2F2"/></a:solidFill>' : ''}</a:tcPr></a:tc>`).join('')}</a:tr>`).join('');
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${colW * nc}" cy="${rowH * rows.length}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"/><a:tblGrid>${grid}</a:tblGrid>${trs}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}
function picShape(id, rid, box, name) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${esc(name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${box.x}" y="${box.y}"/><a:ext cx="${box.w}" cy="${box.h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

/**
 * doc: { slides: [{index, skipped, title, body:[string], notes, images:[{bytes,name}], thumb:{bytes,name}|null,
 *        tableRows?: [ [[string]] ] (each table as rows of cell text)}] }
 * Returns the .pptx bytes.
 */
export function makePptx(zipSync, doc, { title = '' } = {}) {
  const files = {};
  const media = []; // {path, bytes, ext}
  const mediaKey = new Map();
  const addMedia = (im) => {
    const sz = imageSize(im.bytes); if (!sz || !sz.w || !sz.h) return null;
    const key = im.bytes.length + ':' + (im.name || '');
    if (!mediaKey.has(key)) { const path = `ppt/media/image${media.length + 1}.${sz.ext === 'jpeg' ? 'jpeg' : sz.ext}`; media.push({ path, bytes: im.bytes, ext: sz.ext }); mediaKey.set(key, path); }
    return { path: mediaKey.get(key), ...sz };
  };
  const slides = doc.slides || [];
  const M = 457200; // 0.5in margin
  slides.forEach((s, i) => {
    const n = i + 1;
    const rels = [`<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`];
    let shapes = '', id = 2;
    const bodyLines = (s.body || []).flatMap((b) => String(b).split('\n')).map((l) => l.trim()).filter(Boolean);
    const pics = (s.images || []).map(addMedia).filter(Boolean).slice(0, 2);
    const tables = (s.tableRows || []).filter((t) => t && t.length).slice(0, 2);
    const hasText = !!(s.title || bodyLines.length || tables.length);
    if (!hasText && !pics.length && s.thumb) { const t = addMedia(s.thumb); if (t) pics.push({ ...t, full: true }); }
    const titleH = 1100000;
    if (s.title || hasText) shapes += textShape(id++, 'Title', '<p:ph type="title"/>', M, 300000, W - 2 * M, titleH, s.title ? [s.title] : [], 3600, false, 'b');
    const top = 300000 + titleH + 150000, availH = H - top - M;
    const textW = pics.length && (bodyLines.length || (s.tableRows || []).length) ? Math.round((W - 2 * M) * 0.55) : W - 2 * M;
    let bodyH = availH;
    if (tables.length) {
      bodyH = bodyLines.length ? Math.round(availH * 0.35) : 0;
      const tTop = top + bodyH, tH = (availH - bodyH) / tables.length;
      tables.forEach((rows, k) => { shapes += tableShape(id++, rows.slice(0, 40), M, Math.round(tTop + k * tH), textW, Math.round(tH - 100000)); });
    }
    if (bodyLines.length) shapes += textShape(id++, 'Content', '<p:ph idx="1"/>', M, top, textW, bodyH, bodyLines, bodyLines.length > 8 ? 1600 : 2000, true);
    pics.forEach((p, k) => {
      const rid = `rId${rels.length + 1}`;
      rels.push(`<Relationship Id="${rid}" Type="${REL}/image" Target="../media/${p.path.split('/').pop()}"/>`);
      let box;
      if (p.full) box = fit(p.w, p.h, 0, 0, W, H);
      else {
        const side = bodyLines.length || tables.length;
        const bx = side ? M + textW + 200000 : M, bw = side ? W - M - bx : W - 2 * M;
        const per = pics.length === 2 ? Math.round((availH - 150000) / 2) : availH;
        box = fit(p.w, p.h, bx, top + k * (per + 150000), bw, hasText ? per : H - 2 * M);
        if (!hasText) box = fit(p.w, p.h, M, M, W - 2 * M, H - 2 * M);
      }
      shapes += picShape(id++, rid, box, `Picture ${k + 1}`);
    });
    if (s.notes) rels.push(`<Relationship Id="rId${rels.length + 1}" Type="${REL}/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/>`);
    files[`ppt/slides/slide${n}.xml`] = enc(`${XML}<p:sld ${NS}${s.skipped ? ' show="0"' : ''}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
    files[`ppt/slides/_rels/slide${n}.xml.rels`] = enc(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
    if (s.notes) {
      const nl = String(s.notes).split('\n');
      files[`ppt/notesSlides/notesSlide${n}.xml`] = enc(`${XML}<p:notes ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${paras(nl, 1200, false)}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`);
      files[`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`] = enc(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/notesMaster" Target="../notesMasters/notesMaster1.xml"/><Relationship Id="rId2" Type="${REL}/slide" Target="../slides/slide${n}.xml"/></Relationships>`);
    }
  });
  if (!slides.length) {
    files['ppt/slides/slide1.xml'] = enc(`${XML}<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sld>`);
    files['ppt/slides/_rels/slide1.xml.rels'] = enc(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`);
  }
  const count = Math.max(1, slides.length);
  const hasNotes = slides.some((s) => s.notes);
  for (const m of media) files[m.path] = [m.bytes, { level: 0 }];

  const theme = (name) => `${XML}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${name}"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface="Yu Gothic"/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface="Yu Gothic"/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
  const tree = (inner = '') => `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${inner}</p:spTree>`;
  const clrMap = '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';
  const lvl = (sz) => `<a:lvl1pPr><a:defRPr sz="${sz}"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/></a:defRPr></a:lvl1pPr>`;
  files['ppt/slideMasters/slideMaster1.xml'] = enc(`${XML}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${tree(
    textShape(2, 'Title Placeholder', '<p:ph type="title"/>', M, 300000, W - 2 * M, 1100000, [], 3600, false, 'b') +
    textShape(3, 'Text Placeholder', '<p:ph type="body" idx="1"/>', M, 1550000, W - 2 * M, H - 1550000 - M, [], 2000, true))}</p:cSld>${clrMap}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle>${lvl(3600)}</p:titleStyle><p:bodyStyle>${lvl(2000)}</p:bodyStyle><p:otherStyle>${lvl(1800)}</p:otherStyle></p:txStyles></p:sldMaster>`);
  files['ppt/slideMasters/_rels/slideMaster1.xml.rels'] = enc(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${REL}/theme" Target="../theme/theme1.xml"/></Relationships>`);
  files['ppt/slideLayouts/slideLayout1.xml'] = enc(`${XML}<p:sldLayout ${NS} type="obj" preserve="1"><p:cSld name="Title and Content">${tree(
    textShape(2, 'Title 1', '<p:ph type="title"/>', M, 300000, W - 2 * M, 1100000, [], 3600, false, 'b') +
    textShape(3, 'Content Placeholder 2', '<p:ph idx="1"/>', M, 1550000, W - 2 * M, H - 1550000 - M, [], 2000, true))}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  files['ppt/slideLayouts/_rels/slideLayout1.xml.rels'] = enc(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);
  files['ppt/theme/theme1.xml'] = enc(theme('Docpeek'));
  if (hasNotes) {
    files['ppt/notesMasters/notesMaster1.xml'] = enc(`${XML}<p:notesMaster ${NS}><p:cSld>${tree(
      `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1143000"/><a:ext cx="5486400" cy="3086100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>` +
      `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="ja-JP"/></a:p></p:txBody></p:sp>`)}</p:cSld>${clrMap}<p:notesStyle>${lvl(1200)}</p:notesStyle></p:notesMaster>`);
    files['ppt/notesMasters/_rels/notesMaster1.xml.rels'] = enc(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/theme" Target="../theme/theme2.xml"/></Relationships>`);
    files['ppt/theme/theme2.xml'] = enc(theme('Docpeek Notes'));
  }
  const sldIds = Array.from({ length: count }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('');
  files['ppt/presentation.xml'] = enc(`${XML}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>${hasNotes ? `<p:notesMasterIdLst><p:notesMasterId r:id="rId${count + 2}"/></p:notesMasterIdLst>` : ''}<p:sldIdLst>${sldIds}</p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle>${lvl(1800)}</p:defaultTextStyle></p:presentation>`);
  const prels = [`<Relationship Id="rId1" Type="${REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/>`];
  for (let i = 0; i < count; i++) prels.push(`<Relationship Id="rId${i + 2}" Type="${REL}/slide" Target="slides/slide${i + 1}.xml"/>`);
  if (hasNotes) prels.push(`<Relationship Id="rId${count + 2}" Type="${REL}/notesMaster" Target="notesMasters/notesMaster1.xml"/>`);
  prels.push(`<Relationship Id="rId${count + 3}" Type="${REL}/theme" Target="theme/theme1.xml"/>`);
  files['ppt/_rels/presentation.xml.rels'] = enc(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${prels.join('')}</Relationships>`);
  files['_rels/.rels'] = enc(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  files['docProps/core.xml'] = enc(`${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title)}</dc:title><dc:creator>Docpeek</dc:creator></cp:coreProperties>`);
  const ov = (part, type) => `<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.${type}"/>`;
  let ct = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/>`;
  ct += ov('ppt/presentation.xml', 'presentationml.presentation.main+xml') + ov('ppt/slideMasters/slideMaster1.xml', 'presentationml.slideMaster+xml') + ov('ppt/slideLayouts/slideLayout1.xml', 'presentationml.slideLayout+xml') + ov('ppt/theme/theme1.xml', 'theme+xml');
  for (let i = 0; i < count; i++) ct += ov(`ppt/slides/slide${i + 1}.xml`, 'presentationml.slide+xml');
  if (hasNotes) {
    ct += ov('ppt/notesMasters/notesMaster1.xml', 'presentationml.notesMaster+xml') + ov('ppt/theme/theme2.xml', 'theme+xml');
    slides.forEach((s, i) => { if (s.notes) ct += ov(`ppt/notesSlides/notesSlide${i + 1}.xml`, 'presentationml.notesSlide+xml'); });
  }
  ct += '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
  files['[Content_Types].xml'] = enc(ct);
  return zipSync(files, { level: 6 });
}
export const _units = { W, H, EMU };
