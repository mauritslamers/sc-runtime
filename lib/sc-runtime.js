var util = require('util');
var SC = require('./runtime/runtime');
module.SC = SC;
require('./foundation/foundation');

exports = module.exports = SC;

// if(!global.SC){
//   require('./runtime/core');
//   require('./foundation/core');
//   require('./query');
// }