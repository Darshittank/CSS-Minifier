/* ─── CSS Minifier ─────────────────────────────────────── */
function minifyCSS(input) {
const src = input;
const len = src.length;
let i = 0;

// FIRST: Extract ALL comments with their EXACT content before any processing
const commentMap = {}; // Store comments with unique IDs
let commentCount = 0;
let withCommentsReplaced = src;

// Replace all comments with unique placeholders
const commentRegex = /\/\*[\s\S]*?\*\//g;
withCommentsReplaced = src.replace(commentRegex, (match) => {
    const id = `__COMMENT_${commentCount}__`;
    commentMap[id] = match; // Store EXACT comment content
    commentCount++;
    return id;
});

// Now minify the CSS code (without comments)
const minified = compressCodeSegment(withCommentsReplaced);

// FINALLY: Restore all comments EXACTLY as they were
let result = minified;
for (const [id, comment] of Object.entries(commentMap)) {
    result = result.replace(id, comment);
}

// Add line breaks after comments if they're followed by a selector
result = result.replace(/(\*\/)\s*(?=[.#:\w])/g, '$1\n');

return result.trim();
}

function compressCodeSegment(code) {
// 1. Normalize line endings
code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

// 2. Collapse whitespace sequences (spaces, tabs) into single space
code = code.replace(/[ \t]+/g, ' ');
code = code.replace(/ +/g, ' ');

// 3. Remove spaces around structural characters
code = code.replace(/ *\{ */g, '{');
code = code.replace(/ *\} */g, '}');
code = code.replace(/ *: */g, ':');
code = code.replace(/ *; */g, ';');
code = code.replace(/ *\, */g, ',');

// 4. Remove blank lines / excess newlines
code = code.replace(/\n+/g, '\n');
code = code.replace(/^\n/, '');
code = code.replace(/\n+$/g, '');

// 5. Parse and restructure CSS with proper bracket matching
let out = '';
let i = 0;
const len = code.length;

while (i < len) {
    // Skip whitespace and newlines
    while (i < len && /[\s\n]/.test(code[i])) i++;
    if (i >= len) break;

    // Find the opening brace for this rule/at-rule
    let selectorStart = i;
    let bracePos = code.indexOf('{', i);
    
    if (bracePos === -1) {
    // No more braces, add remaining content
    let remaining = code.slice(i).trim();
    if (remaining) out += remaining;
    break;
    }

    // Extract selector
    let selector = code.slice(selectorStart, bracePos)
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

    // Find matching closing brace with proper depth tracking
    let depth = 1;
    let contentStart = bracePos + 1;
    let contentEnd = contentStart;
    
    while (contentEnd < len && depth > 0) {
    if (code[contentEnd] === '{') depth++;
    else if (code[contentEnd] === '}') depth--;
    contentEnd++;
    }
    contentEnd--; // Back to the closing brace position

    let blockContent = code.slice(contentStart, contentEnd).trim();

    if (selector) {
    // Check if this is an at-rule or nested block (has unshielded braces)
    let hasNestedBraces = false;
    let d = 0;
    for (let idx = 0; idx < blockContent.length; idx++) {
        if (blockContent[idx] === '{') d++;
        else if (blockContent[idx] === '}') d--;
        if (d > 0) {
        hasNestedBraces = true;
        break;
        }
    }

    if (hasNestedBraces) {
        // At-rule (@media, @keyframes, etc.) with nested rules
        let innerMinified = compressCodeSegment(blockContent);
        out += selector + '{\n' + innerMinified + '\n}\n';
    } else {
        // Regular CSS rule with properties
        let props = blockContent
        .replace(/\n/g, ' ')           // Replace newlines with space
        .replace(/\s+/g, ' ')          // Collapse multiple spaces
        .trim();
        
        // Split properties by semicolon
        let propArray = props.split(';')
        .map(p => p.trim())
        .filter(p => p && p.length > 0);
        
        // Check if propArray contains only comment placeholders (no actual properties)
        let hasActualProperties = propArray.some(p => !/^__COMMENT_\d+__$/.test(p));
        
        if (hasActualProperties) {
        // Has actual properties - rejoin and add semicolon
        props = propArray.join(';') + ';';
        out += selector + '{' + props + '}\n';
        } else {
        // No actual properties (only comments/placeholders or empty)
        // Join without adding semicolon, and remove trailing semicolon if present
        props = propArray.join(';').replace(/;+$/, '');
        out += selector + '{' + props + '}\n';
        }
    }
    }

    i = contentEnd + 1;
}

return out.trim();
}

/* ─── UI Logic ─────────────────────────────────────────── */
const inputEl    = document.getElementById('inputCSS');
const outputEl   = document.getElementById('outputCSS');
const minifyBtn  = document.getElementById('minifyBtn');
const copyBtn    = document.getElementById('copyBtn');
const downloadBtn= document.getElementById('downloadBtn');
const clearBtn   = document.getElementById('clearBtn');
const liveToggle = document.getElementById('liveToggle');
const inputBytes = document.getElementById('inputBytes');
const outputBytes= document.getElementById('outputBytes');
const savingsBadge = document.getElementById('savingsBadge');
const savingsText  = document.getElementById('savingsText');
const outputHint   = document.getElementById('outputHint');

function formatBytes(b) {
if (b < 1024) return b + ' B';
return (b / 1024).toFixed(1) + ' KB';
}

function updateInputMeta() {
const bytes = new TextEncoder().encode(inputEl.value).length;
inputBytes.textContent = formatBytes(bytes);
}

function runMinify() {
const input = inputEl.value.trim();
if (!input) {
    outputEl.value = '';
    outputBytes.textContent = '0 B';
    copyBtn.disabled = true;
    downloadBtn.disabled = true;
    savingsBadge.classList.remove('visible');
    outputHint.textContent = 'Ready';
    return;
}

const minified = minifyCSS(input);
outputEl.value = minified;

const inB  = new TextEncoder().encode(input).length;
const outB = new TextEncoder().encode(minified).length;
outputBytes.textContent = formatBytes(outB);

const saved = inB - outB;
const pct   = inB > 0 ? Math.round((saved / inB) * 100) : 0;

if (saved > 0) {
    savingsText.textContent = formatBytes(saved) + ` (${pct}% smaller)`;
    savingsBadge.classList.add('visible');
} else {
    savingsBadge.classList.remove('visible');
}

outputHint.textContent = `${minified.split('\n').filter(l => l.trim()).length} rules`;

copyBtn.disabled = false;
downloadBtn.disabled = false;

// Animate output panel
gsap.fromTo('#panels .panel:last-child', 
    { y: 4, opacity: .7 }, 
    { y: 0, opacity: 1, duration: .35, ease: 'power2.out' }
);
}

minifyBtn.addEventListener('click', () => {
gsap.to('#minifyBtn', { scale: .94, duration: .1, yoyo: true, repeat: 1 });
runMinify();
});

inputEl.addEventListener('input', () => {
updateInputMeta();
if (liveToggle.checked) runMinify();
});

clearBtn.addEventListener('click', () => {
inputEl.value = '';
outputEl.value = '';
inputBytes.textContent = '0 B';
outputBytes.textContent = '0 B';
copyBtn.disabled = true;
downloadBtn.disabled = true;
savingsBadge.classList.remove('visible');
outputHint.textContent = 'Ready';
gsap.fromTo('#panels', { opacity: .8 }, { opacity: 1, duration: .3 });
});

copyBtn.addEventListener('click', async () => {
if (!outputEl.value) return;
try {
    await navigator.clipboard.writeText(outputEl.value);
    showToast('✓ Copied to clipboard');
} catch {
    outputEl.select();
    document.execCommand('copy');
    showToast('✓ Copied!');
}
gsap.to('#copyBtn', { scale: .93, duration: .08, yoyo: true, repeat: 1 });
});

downloadBtn.addEventListener('click', () => {
if (!outputEl.value) return;
const blob = new Blob([outputEl.value], { type: 'text/css' });
const url  = URL.createObjectURL(blob);
const a    = document.createElement('a');
a.href = url;
a.download = 'minified.css';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
showToast('⬇ Downloading minified.css');
gsap.to('#downloadBtn', { scale: .93, duration: .08, yoyo: true, repeat: 1 });
});

function showToast(msg) {
const t = document.createElement('div');
t.className = 'toast';
t.textContent = msg;
document.getElementById('toastContainer').appendChild(t);
gsap.to(t, { opacity: 1, y: 0, duration: .35, ease: 'back.out(1.4)' });
setTimeout(() => {
    gsap.to(t, { opacity: 0, y: 10, duration: .3, onComplete: () => t.remove() });
}, 2600);
}

/* ─── Theme Toggle ─────────────────────────────────────── */
const themeToggle = document.getElementById('themeToggle');
const htmlEl = document.documentElement;

// Load saved theme preference
const savedTheme = localStorage.getItem('csspress-theme') || 'light';
if (savedTheme === 'dark') {
document.body.classList.add('dark-mode');
themeToggle.textContent = '☀️';
}

themeToggle.addEventListener('click', () => {
const isDark = document.body.classList.toggle('dark-mode');
themeToggle.textContent = isDark ? '☀️' : '🌙';
localStorage.setItem('csspress-theme', isDark ? 'dark' : 'light');

// Animate toggle
gsap.to('#themeToggle', { scale: 0.85, duration: .15, yoyo: true, repeat: 1 });

// Subtle flash animation
gsap.fromTo('body', 
    { opacity: 0.95 },
    { opacity: 1, duration: .4, ease: 'power2.out' }
);
});

/* ─── GSAP Entrance Animations ─────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
// Blobs entrance
gsap.to('.blob-1', { opacity: 1, duration: 2.5, ease: 'power2.out' });
gsap.to('.blob-2', { opacity: 1, duration: 2.5, delay: .4, ease: 'power2.out' });
gsap.to('.blob-3', { opacity: 1, duration: 2.5, delay: .8, ease: 'power2.out' });

// Blob float animations
gsap.to('.blob-1', {
    x: 40, y: 30,
    duration: 10, repeat: -1, yoyo: true,
    ease: 'sine.inOut'
});
gsap.to('.blob-2', {
    x: -30, y: -40,
    duration: 13, repeat: -1, yoyo: true,
    ease: 'sine.inOut',
    delay: 2
});
gsap.to('.blob-3', {
    x: 20, y: -20,
    duration: 9, repeat: -1, yoyo: true,
    ease: 'sine.inOut',
    delay: 1
});

// UI entrance
const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
tl.to('#header',   { opacity: 1, y: 0, duration: .7, from: { y: 30 } }, .2)
    .from('#header .logo-badge', { y: -12, opacity: 0, duration: .5 }, .1)
    .from('#header h1', { y: 20, opacity: 0, duration: .65 }, .3)
    .from('#header p',  { y: 15, opacity: 0, duration: .55 }, .45)
    .from('.stat-chip', { y: 10, opacity: 0, duration: .4, stagger: .08 }, .55)
    .to('#toolbar',  { opacity: 1, y: 0, duration: .55, from: { y: 20 } }, .6)
    .to('#panels',   { opacity: 1, y: 0, duration: .65, from: { y: 24 } }, .72)
    .to('#actionBar',{ opacity: 1, y: 0, duration: .5, from: { y: 16 } }, .85)
    .to('#footer',   { opacity: 1, duration: .5 }, 1.0);

// Button hover micro-interactions via JS (GSAP)
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
    if (!btn.disabled) gsap.to(btn, { scale: 1.04, duration: .2, ease: 'power2.out' });
    });
    btn.addEventListener('mouseleave', () => {
    gsap.to(btn, { scale: 1, duration: .2, ease: 'power2.out' });
    });
});
});

// Subtle parallax on mouse move
document.addEventListener('mousemove', (e) => {
const xN = (e.clientX / window.innerWidth  - .5) * 2;
const yN = (e.clientY / window.innerHeight - .5) * 2;
gsap.to('.blob-1', { x: xN * 25 + 0, y: yN * 20, duration: 3, ease: 'power1.out', overwrite: 'auto' });
gsap.to('.blob-2', { x: xN * -18, y: yN * -14, duration: 3.5, ease: 'power1.out', overwrite: 'auto' });
gsap.to('.blob-3', { x: xN * 12, y: yN * 16, duration: 4, ease: 'power1.out', overwrite: 'auto' });
});
