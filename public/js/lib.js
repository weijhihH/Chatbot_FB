/* eslint-disable no-undef */
/* eslint-disable no-plusplus */
/* eslint-disable func-names */
// global parameters
const app = {
  fb: {},
  state: {
    auth: null,
  },
  cst: {
    apiVersion: '1.0',
  },
  profile: {},
  greetingMessage: {
    SubmitButtonStatus: null,
  },
  buttonTemplate: {
    numberOfSet: 1,
    SubmitButtonStatus: null,
  },
  moreSetting: {
    SubmitButtonStatus: null,
  },
  broadcast: {
    numberOfSet: null,
  },
};

app.fb.load = function () {
  // Load the SDK asynchronously
  (function (d, s, id) {
    let js = {};
    const fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s);
    js.id = id;
    js.src = 'https://connect.facebook.net/zh_TW/sdk.js';
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));
};
app.fb.init = function () {
  FB.init({
    appId: '825490901136292',
    cookie: true,
    xfbml: true,
    version: 'v3.2',
  });
  FB.AppEvents.logPageView();
  FB.getLoginStatus((response) => {
    // set member click handlers
    if (response.status === 'connected') {
      // 送出 ajax 連線給 server 更新 token
      console.log(response.authResponse.accessToken);
    } else {
      // 沒有連線成功
      console.log(response.status);
    }
  });
};

app.getCookie = function (cname) {
  const name = `${cname}=`;
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return '';
};

app.getParameter = function (name) {
  let result = null; let tmp = [];
  window.location.search.substring(1).split('&').forEach((item) => {
    tmp = item.split('=');
    if (tmp[0] === name) {
      result = decodeURIComponent(tmp[1]);
    }
  });
  return result;
};

app.formatDate = function (date) {
  const d = new Date(date);
  let month = `${d.getMonth() + 1}`;
  let day = `${d.getDate()}`;
  const year = d.getFullYear();

  if (month.length < 2) month = `0${month}`;
  if (day.length < 2) day = `0${day}`;

  return [year, month, day].join('-');
};
