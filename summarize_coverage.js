const fs = require('fs');
const results = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
const coverage = results.coverageMap;

let totalStatements = 0;
let coveredStatements = 0;
let totalBranches = 0;
let coveredBranches = 0;

for (const file in coverage) {
    const data = coverage[file];
    Object.values(data.s).forEach(count => {
        totalStatements++;
        if (count > 0) coveredStatements++;
    });
    Object.values(data.b).forEach(branches => {
        branches.forEach(count => {
            totalBranches++;
            if (count > 0) coveredBranches++;
        });
    });
}

console.log(`Statements: ${Math.round((coveredStatements / totalStatements) * 100)}% (${coveredStatements}/${totalStatements})`);
console.log(`Branches: ${Math.round((coveredBranches / totalBranches) * 100)}% (${coveredBranches}/${totalBranches})`);
