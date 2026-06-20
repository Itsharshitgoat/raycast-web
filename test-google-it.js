const googleIt = require('google-it');
googleIt({ query: 'test search' }).then(results => {
  console.log("Google It results:", results.length);
}).catch(e => {
  console.error(e);
});
