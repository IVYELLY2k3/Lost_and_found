const Vibrant = require('node-vibrant/node');
console.log('Type of Vibrant:', typeof Vibrant);
console.log('Vibrant keys:', Object.keys(Vibrant));
console.log('Is Vibrant a class?', Vibrant.prototype ? 'Yes' : 'No');
if (Vibrant.default) console.log('Vibrant.default keys:', Object.keys(Vibrant.default));
