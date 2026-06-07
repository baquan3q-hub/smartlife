const fs = require('fs');
const path = require('path');

const statusPath = path.join(__dirname, 'status.txt');
const diffPath = path.join(__dirname, 'diff.txt');

try {
    if (fs.existsSync(statusPath)) {
        const statusContent = fs.readFileSync(statusPath, 'utf16le');
        fs.writeFileSync(path.join(__dirname, 'status_utf8.txt'), statusContent, 'utf8');
        console.log('Successfully converted status.txt to status_utf8.txt');
    } else {
        console.log('status.txt does not exist');
    }

    if (fs.existsSync(diffPath)) {
        const diffContent = fs.readFileSync(diffPath, 'utf16le');
        fs.writeFileSync(path.join(__dirname, 'diff_utf8.txt'), diffContent, 'utf8');
        console.log('Successfully converted diff.txt to diff_utf8.txt');
    } else {
        console.log('diff.txt does not exist');
    }
} catch (err) {
    console.error('Error during conversion:', err);
}
