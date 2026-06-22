const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/VisualBoard.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// Parse simple JSX open and close tags
// We can track the depth of tags
const lines = content.split('\n');
let depth = 0;
const tagStack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Simple regex to match JSX tags
  // Note: this is a simple approximation to count divs
  const matches = line.match(/<\/?div[ >]/g);
  if (matches) {
    for (const match of matches) {
      if (match.startsWith('</')) {
        depth--;
        if (tagStack.length > 0) tagStack.pop();
      } else {
        depth++;
        tagStack.push(i + 1);
      }
    }
  }
}
console.log('Net div depth at end of file:', depth);
console.log('Stack:', tagStack);
