// 用 GitHub REST API 提交文件（绕开不稳定的 git push HTTPS POST）
// 用法: node scripts/api-push.mjs "commit message" <file1> <file2> ...
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const TOKEN = execSync('gh auth token').toString().trim();
const OWNER = 'gzy3894-png';
const REPO = 'xiao-li-yang-ji';
const BRANCH = 'main';

const message = process.argv[2];
const files = process.argv.slice(3);
if (!message || !files.length) {
  console.error('usage: node scripts/api-push.mjs "msg" file1 file2 ...');
  process.exit(1);
}

async function api(path, opts = {}, retry = 8) {
  const url = `https://api.github.com${path}`;
  for (let i = 0; i < retry; i++) {
    try {
      const res = await fetch(url, {
        ...opts,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          ...(opts.headers || {})
        }
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (res.status >= 200 && res.status < 300) return data;
      throw new Error(`${path} -> ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
    } catch (e) {
      if (i === retry - 1) throw e;
      console.warn(`retry ${i + 1}/${retry} ${path}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 12000));
    }
  }
}

const baseRef = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
const baseSha = baseRef.object.sha;
console.log('base:', baseSha);
const baseCommit = await api(`/repos/${OWNER}/${REPO}/git/commits/${baseSha}`);
const baseTree = baseCommit.tree.sha;

const treeEntries = [];
for (const f of files) {
  if (f.alt) {
    await api(`/repos/${OWNER}/${REPO}/git/refs/${f.path}`, { method: 'DELETE' }).catch((e) => console.warn('delete', f.path, ':', e.message));
    continue;
  }
  if (f === '.verify.bundle.mjs') continue;
  let content;
  try {
    content = readFileSync(f);
  } catch {
    throw new Error(`cannot read ${f}`);
  }
  const blob = await api(`/repos/${OWNER}/${REPO}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: content.toString('base64'), encoding: 'base64' })
  });
  treeEntries.push({ path: f.split(String.fromCharCode(92)).join('/'), mode: '100644', type: 'blob', sha: blob.sha });
  console.log('blob', f, blob.sha.slice(0, 8));
}

const newTree = await api(`/repos/${OWNER}/${REPO}/git/trees`, {
  method: 'POST',
  body: JSON.stringify({ base_tree: baseTree, tree: treeEntries })
});

const newCommit = await api(`/repos/${OWNER}/${REPO}/git/commits`, {
  method: 'POST',
  body: JSON.stringify({ message, tree: newTree.sha, parents: [baseSha] })
});

await api(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
  method: 'PATCH',
  body: JSON.stringify({ sha: newCommit.sha, force: false })
});

console.log('pushed commit:', newCommit.sha.slice(0, 8), '(', files.length, 'files )');
