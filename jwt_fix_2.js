const fs = require('fs');
const { execSync } = require('child_process');

try {
    const files = execSync('grep -rl "a1b2c3d4" apps/web/src').toString().split('\n').filter(Boolean);

    files.forEach(file => {
        let content = fs.readFileSync(file, 'utf8');

        // Remove the left over hanging string literals after we broke the objects
        content = content.replace(/['"]a1b2c3d4[\-0-9a-f]+['"]/g, '');
        // Sometimes it leaves an empty hanging `||` before the string literal
        content = content.replace(/([,{|])\s*\|\|\s*/g, '$1');
        // Clean out remaining localstorage items in Authorization headers
        content = content.replace(/['"]?Authorization['"]?:\s*`Bearer.+?`,?/g, '');
        content = content.replace(/['"]?x-tenant-id['"]?:\s*tenantId\s*\|\|\s*,?/g, '');
        content = content.replace(/['"]?x-tenant-id['"]?:\s*localStorage\.getItem\(['"]tenantId['"]\)\s*\|\|\s*,?/g, '');

        fs.writeFileSync(file, content, 'utf8');
    });
} catch (e) {
    if(!e.message.includes('Command failed: grep')) {
      console.log('Error: ', e.message);
    }
}
