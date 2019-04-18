// global parameters
let app={
  fb:{},
  state:{
    auth:null
  },
  cst:{
    apiVersion: '1.0',
  },
  profile:{}
}

app.fb.load= function() {
  	// Load the SDK asynchronously
	(function(d, s, id){
		var js, fjs = d.getElementsByTagName(s)[0];
		if (d.getElementById(id)) return;
		js = d.createElement(s); js.id = id;
		js.src = "https://connect.facebook.net/zh_TW/sdk.js";
		fjs.parentNode.insertBefore(js, fjs);
	}(document, "script", "facebook-jssdk"));
};
app.fb.init= function () {
  FB.init({
		appId:"825490901136292",
    cookie:true, 
    xfbml:true,
		version:"v3.2"
  });
  FB.AppEvents.logPageView();
	FB.getLoginStatus(function(response){
    // set member click handlers
    if (response.status === 'connected'){
      //送出 ajax 連線給 server 更新 token
      console.log(response.authResponse.accessToken)
    } else {
      // 沒有連線成功
      console.log(response.status);
    }
  });
}

app.getCookie = function(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for(var i = 0; i <ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

app.getParameter = function (name) {
  let result=null, tmp=[];
  window.location.search.substring(1).split("&").forEach(function(item){
    tmp = item.split("=");
    if(tmp[0] === name){
      result = decodeURIComponent(tmp[1]);
    }
  })
  return result;
}





