const fs = require('fs');
const { execSync } = require('child_process');

try {
    const files = execSync('grep -rl "||" apps/web/src').toString().split('\n').filter(Boolean);

    files.forEach(file => {
        let content = fs.readFileSync(file, 'utf8');

        // Fix hanging OR operators left by the regex
        // E.g: || 'a1b2c3d4...'; 
        content = content.replace(/^\s*\|\|\s*['"][^'"]+['"];?\s*$/gm, '');
        content = content.replace(/let\s+tenantId\s*=\s*(?:\n|\s)*\|\|/g, 'let tenantId =');
        content = content.replace(/const\s+tenantId\s*=\s*(?:\n|\s)*\|\|/g, 'const tenantId =');
        content = content.replace(/let\s+studentId\s*=\s*(?:\n|\s)*\|\|[^;]+;/g, '');
        content = content.replace(/const\s+studentId\s*=\s*(?:\n|\s)*\|\|[^;]+;/g, '');

        fs.writeFileSync(file, content, 'utf8');
    });

} catch (e) {
    console.log('Error: ', e.message);
}
