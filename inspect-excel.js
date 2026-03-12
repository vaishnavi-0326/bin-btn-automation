const XLSX = require('xlsx');
const path = require('path');

const file = path.join(__dirname, 'sites.xlsx');
const workbook = XLSX.readFile(file);

console.log('Sheet names:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  console.log(`\n--- Sheet: ${sheetName} ---`);
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log('Columns:', data.length > 0 ? Object.keys(data[0]) : 'No data');
  console.log('First few rows:');
  data.slice(0, 3).forEach((row, i) => {
    console.log(`Row ${i + 1}:`, row);
  });
});
