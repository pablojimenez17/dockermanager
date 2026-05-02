const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');

const replaceInFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Replace roundings to industrial square style
    content = content.replace(/rounded-3xl/g, 'rounded-sm');
    content = content.replace(/rounded-2xl/g, 'rounded-sm');
    content = content.replace(/rounded-xl/g, 'rounded-sm');
    content = content.replace(/rounded-lg/g, 'rounded-sm');
    
    // Replace heavy shadows to subtle ones
    content = content.replace(/shadow-2xl/g, 'shadow-md');
    content = content.replace(/shadow-xl/g, 'shadow-sm');
    content = content.replace(/shadow-lg/g, 'shadow-sm');
    
    // Remove complex gradients on text
    content = content.replace(/text-transparent bg-clip-text bg-gradient-to-[a-z]+ from-[a-z]+-[0-9]+ (via-[a-z]+-[0-9]+ )?to-[a-z]+-[0-9]+/g, 'text-brand-500');
    content = content.replace(/bg-gradient-to-[a-z]+ from-[a-z]+-[0-9]+ to-[a-z]+-[0-9]+ bg-clip-text text-transparent/g, 'text-brand-500');

    // Replace gradient backgrounds (e.g., buttons, badges)
    content = content.replace(/bg-gradient-to-[a-z]+ from-[a-z]+-[0-9]+ (via-[a-z]+-[0-9]+ )?to-[a-z]+-[0-9]+/g, 'bg-brand-600 hover:bg-brand-700');
    
    // Sometimes there are gradients with opacity e.g. from-brand-500/10
    content = content.replace(/bg-gradient-to-[a-z]+ from-[a-z]+-[0-9]+\/\d+ to-[a-z]+-[0-9]+\/\d+/g, 'bg-brand-900/20');
    
    // Write back
    fs.writeFileSync(filePath, content, 'utf-8');
}

fs.readdirSync(pagesDir).forEach(file => {
    if (file.endsWith('.jsx')) {
        replaceInFile(path.join(pagesDir, file));
    }
});
console.log("UI Fixed");
