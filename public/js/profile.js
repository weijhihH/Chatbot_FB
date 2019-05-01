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
  console.log('12313',res)
  if(res.error){
    return rejects(res.error)
  }
  app.profile = res.data;
  let content =''
  let i=0
  if(app.profile.length > 0){
    for(i; i< app.profile.length; i++){
      content += pagesConten(app.profile[i],i,content)
      if(i === app.profile.length-1){
        return content;
      }
    }
  } else{
    // 沒有 page 資訊
    console.log('no page information')
    alert('查無任何 page 資訊, 請確認是否有 facebook 粉絲專頁, 即將導回首頁');
    window.location = '/';
  }
})
.then((content)=>{
  jqueryDom(content);
})
.catch((err) =>{
  console.log('err', err)
  alert(`${err}, 即將導回首頁`);
  window.location = '/';
  
})
}


// profile content 
function pagesConten(profile,i){
  console.log('profile',profile)
  console.log('pagesContent i ', i)
  let html;
  html = `<div class="card" style="width: 18rem;">`
  html +=`<div class="card-body">`
  html += `<h5 class="card-title">專頁 ${i+1}</h5>`
  html += `<h6 class="card-subtitle mb-1 ">Name: </h6>`
  html += `<p class="card-text">${profile.name}</p>`          
  html += `<h6 class="card-subtitle mb-1 ">ID: </h6>`
  html += `<p class="card-text">${profile.id}</p>`
  // html += `<button class="subscribe btn btn-primary btn-block" role="button" aria-pressed="true" value=${i}>訂閱 Webhook</button>`
  html += `<button class="btn btn-primary btn-block" role="button" aria-pressed="true" id=${profile.id}>進入 Dashboard</button>`
  html += `</div>`
  html += `</div>`  
  return html;
}



//控制 jquery events
function jqueryDom (content){
$(function(){
  // render content
  $(".page-content").append(content);
  // 按鈕
  $('.btn').on('click',function(event){
    console.log(event.target.id)
    app.fb.pageId = event.target.id;
    window.location = '/user/dashboard.html?id=' + event.target.id ;
  })
})
}