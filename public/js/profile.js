let accessToken = app.getCookie('Authorization');
console.log(accessToken);

// window.addEventListener("DOMContentLoaded",callback)
// 等同於 $( document ).ready( callback); 初始事件載入
$(document).ready(callback);
  
// fetch : profile data & render to html
function callback() {
fetch('/api/'+app.cst.apiVersion+'/profile',{
  method:'GET',
  headers:{
    'Authorization': 'Bearer '+ accessToken,
  }
})
.then(res => res.json())
.then((res) =>{
  app.profile = res.data;
  let content =''
  let i=0
  if(app.profile.length > 0){
    for(i; i< app.profile.length; i++){
      content += pagesConten(app.profile[i],i,content)
    }
    if(i = app.profile.length-1){
      console.log('999',content)
      return content;
    }
  } else{
    // 沒有 page 資訊
  }
})
.then((content)=>{
  jqueryDom(content);
})
.catch((err) =>{
  alert('查無任何 page 資訊, 請確認是否有 facebook 粉絲專頁, 即將導回首頁');
  // window.location = '/';
  
})
}

// profile content 
function pagesConten(profile,i,content){
  content = `<div class="card" style="width: 18rem;">`
  content +=`<div class="card-body">`
  content += `<h5 class="card-title">頁數 ${i+1}</h5>`
  content += `<h6 class="card-subtitle mb-1 ">ID: </h6>`
  content += `<p class="card-text">"${profile.id}"</p>`
  content += `<h6 class="card-subtitle mb-1 ">Name: </h6>`
  content += `<p class="card-text">"${profile.name}"</p>`          
  content += `<button class="subscribe btn btn-primary btn-block" role="button" aria-pressed="true" value=${i}>訂閱 Webhook</button>`
  content += `<button class="btn btn-primary btn-block" role="button" aria-pressed="true" value=${i}>進入 Dashboard</button>`
  content += `</div>`
  content += `</div>`  
  return content;
}

//控制 jquery events
function jqueryDom (content){
$(function(){
  // render content
  $(".page-content").append(content);
  // 按鈕
  $('.subscribe').on('click',function(event){
    $('.subscribe').addClass('disabled');
    // const index = event.target.value
    // fetch('', {
    //   method:'POST',
    //   headers:{
    //     Authorization: `Bearer ${this.accessToken}`
    //   },
    //   body:{},
    // })
  });
})
}