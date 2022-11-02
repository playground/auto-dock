const api = require('mobile-locator');

const locate = api('google', { key: 'AIzaSyB6bjB5nCb-3ukWkhcwJOkriS2N7mY_hw8' });

locate({ mcc: 310, mnc: 260, lac: 23789, cid: 72872068 })
  .then(location => console.log(JSON.stringify(location, null, 2)));

