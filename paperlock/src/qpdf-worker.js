// Runs qpdf (WebAssembly) off the main thread. Messages: {id, op, data, ...}
importScripts('../vendor/qpdf.js');
let ready = null, errText = '';
function qpdf() {
  ready ||= Module({ locateFile: () => new URL('../vendor/qpdf.wasm', self.location).href, print: () => {}, printErr: (s) => { errText += s + '\n'; } });
  return ready;
}
function run(q, args) { errText = ''; let code; try { code = q.callMain(args); } catch (e) { code = typeof e.status === 'number' ? e.status : 2; } return code; }
const clean = (q) => { for (const f of ['/in.pdf', '/out.pdf']) { try { q.FS.unlink(f); } catch (e) {} } };
self.onmessage = async (e) => {
  const { id, op } = e.data;
  try {
    const q = await qpdf();
    clean(q);
    q.FS.writeFile('/in.pdf', new Uint8Array(e.data.data));
    if (op === 'check') {
      // this qpdf build can't answer --is-encrypted without the password, so look for the /Encrypt entry ourselves
      const u = new Uint8Array(e.data.data); let enc = false;
      for (let i = 0; i < u.length - 8 && !enc; i++) if (u[i] === 47 && u[i + 1] === 69 && u[i + 2] === 110 && u[i + 3] === 99 && u[i + 4] === 114 && u[i + 5] === 121 && u[i + 6] === 112 && u[i + 7] === 116) enc = true;
      let needs = false, bad = false;
      if (enc) { const c = run(q, ['--password=', '--check', '/in.pdf']); needs = c === 2; } // printErr isn't wired in this build, so the exit code is all we get
      else bad = run(q, ['--check', '/in.pdf']) === 2;
      self.postMessage({ id, ok: !bad, enc, needs });
      return;
    }
    let args;
    if (op === 'lock') {
      const r = e.data.restrict || {};
      args = ['--encrypt', e.data.user, e.data.owner, '256'];
      if (r.print) args.push('--print=none');
      if (r.copy) args.push('--extract=n');
      if (r.modify) args.push('--modify=none');
      args.push('--', '/in.pdf', '/out.pdf');
    } else if (op === 'unlock') {
      args = ['--password=' + e.data.password, '--decrypt', '/in.pdf', '/out.pdf'];
    } else throw new Error('unknown op');
    const code = run(q, args);
    if (code !== 0 && code !== 3) { // 3 = success with warnings
      const pw = op === 'unlock' || /password/i.test(errText);
      self.postMessage({ id, ok: false, reason: pw ? 'password' : 'broken', detail: errText.slice(0, 300) });
      return;
    }
    const out = q.FS.readFile('/out.pdf');
    clean(q);
    self.postMessage({ id, ok: true, data: out.buffer }, [out.buffer]);
  } catch (err) { self.postMessage({ id, ok: false, reason: 'broken', detail: String(err && err.message || err) }); }
};
