const fs = require('fs');
const { execSync } = require('child_process');

try {
    const files = execSync('grep -rl "localStorage" apps/web/src').toString().split('\n').filter(Boolean);

    files.forEach(file => {
        let content = fs.readFileSync(file, 'utf8');

        // Remove token/tenantId extractions
        content = content.replace(/const\s+token\s*=\s*localStorage\.getItem\(['"]token['"]\);?\n?/g, '');
        content = content.replace(/const\s+tenantId\s*=\s*localStorage\.getItem\(['"]tenantId['"]\);?\n?/g, '');
        content = content.replace(/let\s+token\s*=\s*localStorage\.getItem\(['"]token['"]\);?\n?/g, '');
        content = content.replace(/const\s+token\s*=\s*localStorage\.getItem\(['"]token['"]\)\s*\|\|\s*['"]['"];?\n?/g, '');

        // Remove localStorage.removeItem/setItem for auth (we'll keep some general ones if they exist, but auth related ones)
        content = content.replace(/localStorage\.setItem\(['"]token['"].*?\n/g, '');
        content = content.replace(/localStorage\.setItem\(['"]tenantId['"].*?\n/g, '');
        content = content.replace(/localStorage\.removeItem\(['"]token['"].*?\n/g, '');
        content = content.replace(/localStorage\.removeItem\(['"]tenantId['"].*?\n/g, '');

        // Drop JWT related Authorizations
        content = content.replace(/['"]?Authorization['"]?:\s*`Bearer \$\{token\}`\s*,?/g, '');
        content = content.replace(/['"]?x-tenant-id['"]?:\s*tenantId\s*,?/g, '');
        content = content.replace(/['"]?x-tenant-id['"]?:\s*localStorage\.getItem\(['"]tenantId['"]\)\s*(\S)*\s*,?/g, '');
        
        // Add credentials
        content = content.replace(/fetch\(([^,]+),\s*\{/g, "fetch($1, {\n                    credentials: 'include',");

        fs.writeFileSync(file, content, 'utf8');
    });

    console.log('Frontend migration script executed across ' + files.length + ' files');
} catch (e) {
    console.log('Error: ', e.message);
}
