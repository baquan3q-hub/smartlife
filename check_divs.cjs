const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('src/components/VisualBoard.tsx', 'utf8');

let pos = 0;
const stack = [];

// Track lines and columns
let lineNum = 1;
let colNum = 1;

while (pos < content.length) {
  const char = content[pos];
  const nextChar = content[pos + 1];

  // Handle line numbering
  if (char === '\n') {
    lineNum++;
    colNum = 1;
  } else {
    colNum++;
  }

  // Skip single-line comments
  if (char === '/' && nextChar === '/') {
    while (pos < content.length && content[pos] !== '\n') {
      pos++;
    }
    continue;
  }

  // Skip multi-line comments
  if (char === '/' && nextChar === '*') {
    pos += 2;
    while (pos < content.length && !(content[pos] === '*' && content[pos+1] === '/')) {
      if (content[pos] === '\n') {
        lineNum++;
        colNum = 1;
      } else {
        colNum++;
      }
      pos++;
    }
    pos += 2;
    continue;
  }

  // Skip string literals (double quotes, single quotes, backticks)
  if (char === '"' || char === "'" || char === '`') {
    const quote = char;
    pos++;
    while (pos < content.length && content[pos] !== quote) {
      if (content[pos] === '\\') {
        pos++; // skip escaped char
      }
      if (content[pos] === '\n') {
        lineNum++;
        colNum = 1;
      } else {
        colNum++;
      }
      pos++;
    }
    pos++;
    continue;
  }

  // Check brackets
  if (char === '(' || char === '{' || char === '[') {
    stack.push({ char, line: lineNum, col: colNum });
  } else if (char === ')' || char === '}' || char === ']') {
    const expected = char === ')' ? '(' : char === '}' ? '{' : '[';
    if (stack.length === 0) {
      console.log(`Unmatched closing ${char} at line ${lineNum}, col ${colNum}`);
    } else {
      const top = stack.pop();
      if (top.char !== expected) {
        console.log(`Mismatched bracket: expected ${expected} for ${char} at line ${lineNum}, col ${colNum}. Opened at line ${top.line}, col ${top.col}`);
      }
    }
  }

  pos++;
}

if (stack.length > 0) {
  console.log('Unclosed brackets/braces remaining:');
  for (const item of stack) {
    console.log(`- ${item.char} opened at line ${item.line}, col ${item.col}`);
  }
} else {
  console.log('All brackets/braces match!');
}
