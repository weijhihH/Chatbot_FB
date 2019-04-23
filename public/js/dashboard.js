let accessToken = app.getCookie('Authorization');


app.init = function (){
  let id = app.getParameter("id");
  if(!id){
    window.location="./";
  }
  app.fb.pageId = id;
}

$(document).ready(callback);

function callback(){
  app.init();
  $(function(){
    // 處理 Wellcome sreen button 
    // 呼叫 api and render to html;
    $('.navWellcomeMessageGreeting').on('click',function(){
      fetch('/api/'+app.cst.apiVersion+'/webhook/greeting/getInformation?pageId='+app.fb.pageId,{
        method:'GET',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
        }
      })
      .then(res => res.json())
      .then((res) => {
        // 將現有資料清掉, 避免重複按的時候出錯
        delForm();
        // Server's data render to html
        let text;
        let response = res.data
        console.log(res);
        if(response === 'NoData'){
          text = '請輸入問候語'
          $('#mainContent').append(wellcomeScreenContent(text));
        } else {
          // 有現成資料, 將資料 render 進去表格, 並且讓表格 disabled
          $('#mainContent').append(wellcomeScreenContent(response));
        }
      })
      .then((res) => {
        $('#wellcomeMessageFormGreeting').show();
        $('#wellcomeMessageForm').hide();
      })
      .catch((err) => {
        console.log('err')
      })
    });


    // wellcome message button 處理
    // 呼叫 api and render to html;

    $('.navWellcomeMessage').on('click',function(){
      fetch('/api/'+app.cst.apiVersion+'/webhook/wellcomeMessage/getInformation?pageId='+app.fb.pageId+'&payload=getStarted',{
        method:'GET',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
        }
      }).then(res => res.json())
      .then((res) => {
        // 移除 wellcome Screen 的內容
        delForm();

        
        // 如果資料庫沒有存任何 template
        if(res.data === 'NoData'){
          $('#mainContent').append(wellcomeMessageContent(res.data));
          $('.form-control').prop('readonly', false);
        } else {
        // 資料庫已經有 template 資料, 取出來必且 render to html
          let info = JSON.parse(res.data.info)
          console.log(info);
          if(info.attachment.payload.template_type === 'button'){
            app.buttonTemplate.numberOfSet = info.attachment.payload.buttons.length
            $('#mainContent').append(wellcomeMessageContent(info));

            $('div.form-row').each(function(){
              $('.addButtonTemplate').prop('disabled', true);
              $('.deleteButtonTemplate').prop('disabled', true);
              $('.payload-type').prop('disabled',true);
            })
          }
        }
      })
      .then(() => {
        $('#wellcomeMessageFormGreeting').hide(); 
        $('#wellcomeMessageForm').show();
      })
      .catch((err) => {
        console.log('err',err);
      })
    });
    
    // 控制 Wellcome Message 內的 Add and Delete Button
    $('#mainContent').on("click","#addButtonTemplate", function () {
      if(app.buttonTemplate.numberOfSet < 3) {
        app.buttonTemplate.numberOfSet += 1
        console.log('app.buttonTemplate.numberOfSet',app.buttonTemplate.numberOfSet)
        let html = `<div class="form-row ">`
        html += `<div class="col-3"><input type="text" class="form-control text" placeholder="Button Name"></div>`
        html += `<div class="col-3"><input type="text" class="form-control payload" placeholder="PostBack Name"></div>`

        html += `<div class="col-1.5">`
        html += `<select class="payload-type custom-select mr-sm-2" id="inlineFormCustomSelect" >`
        html += `<option selected>按鈕類型</option>`
        html += `<option value="postback">回傳按鈕</option>`
        html += `<option value="web_url">url</option>`
        html += `</select></div>`

        html += `<div class="col-1.5"><button type="button" id="addButtonTemplate" class="addButtonTemplate btn btn-primary btn-sm ">Add</button></div>`
        html += `<div class="col-1"><button type="button" id="deleteButtonTemplate" class="deleteButtonTemplate btn btn-primary btn-sm ">Delete</button></div>`
        html += `</div>`
        $(this).closest('.form-row').after(html);
      }
    })













    $('#mainContent').on("click","#deleteButtonTemplate", function (event) {
      if(app.buttonTemplate.numberOfSet > 1) {
        app.buttonTemplate.numberOfSet -= 1
        console.log('app.buttonTemplate.numberOfSet',app.buttonTemplate.numberOfSet)
        $(this).closest('.form-row').remove(); 
      }
    })

    // DOM event for Greeting message edit button;
    $('#mainContent').on("click", "#wellcomeScreenEditButton", function () {
      const html = `<button type="submit" id="wellcomeScreenSubmitButton" class="btn btn-primary mb-2">Submit</button>`
      if(app.greetingMessage.SubmitButtonStatus === null){
        $('#wellcomeScreenTextArea').prop('readonly', false);
        $('#wellcomeScreenEditButton').after(html);
        $('#wellcomeScreenEditButton').prop('disabled', true);
        app.greetingMessage.SubmitButtonStatus = true
      } else if (app.greetingMessage.SubmitButtonStatus === true) {
        $('#wellcomeScreenTextArea').prop('readonly', false);
        $('#wellcomeScreenEditButton').prop('disabled', true);
        $('#wellcomeScreenSubmitButton').prop('disabled', false);
      }
    })

    // DOM event for wellcome screen's submit button;
    $('#mainContent').on("click", "#wellcomeScreenSubmitButton", function (event) {
      const textArea = $('#wellcomeScreenTextArea').val();
      $('#wellcomeScreenSubmitButton').prop('disabled', true);
      event.preventDefault();
      fetch('/api/'+app.cst.apiVersion+'/webhook/greeting',{
        method:'POST',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "data":
          { "text": textArea,
            "pageId": app.fb.pageId
          }
        })
      })
      .then(res => res.json())
      .then((res) =>{ 
        $('#wellcomeScreenTextArea').prop('readonly', true);
        $('#wellcomeScreenEditButton').prop('disabled', false);
        alert('儲存成功........')
        console.log('fetch result:', res)
      })
      .catch((err) => { 
        alert('儲存失敗........')
        console.log('fetch error: ', err)
      })
    })

    // 控制 Wellcome Message 內的 Edit Button
    $('#mainContent').on("click", "#wellcomeMessageEditButton", function () {
      const html = `<button type="submit" id="wellcomeMessageSubmitButton" class="btn btn-primary mb-2">Submit</button>`
      if(app.buttonTemplate.SubmitButtonStatus === null){
        $('.form-control').prop('readonly', false);
        $('#wellcomeMessageEditButton').after(html);
        $('#wellcomeMessageEditButton').prop('disabled', true);

        $('div.form-row').each(function(){
          $('.addButtonTemplate').prop('disabled', false);
          $('.deleteButtonTemplate').prop('disabled', false);
          $('.payload-type').prop('disabled',false);
        })
        app.buttonTemplate.SubmitButtonStatus = true
      } else if (app.buttonTemplate.SubmitButtonStatus === true){
        $('.form-control').prop('readonly', false);
        $('#wellcomeMessageSubmitButton').remove();
        $('#wellcomeMessageEditButton').after(html);
        $('#wellcomeMessageEditButton').prop('disabled', true);
        $('div.form-row').each(function(){
          $('.addButtonTemplate').prop('disabled', false);
          $('.deleteButtonTemplate').prop('disabled', false);
          $('.payload-type').prop('disabled',false);
        })      
      }
    })

    // wellcome message 處理
    $('#mainContent').on("click",'#wellcomeMessageSubmitButton',function(){
      const textArr = [];
      const payloadArr = [];
      const payloadType = [];
      // 將submit 按鈕失效
      $('#wellcomeMessageSubmitButton').prop('disabled', true);
      // 
      // 處理 ajax input datas
      // 
      $('.payload-type').each(function(i){
        payloadType.push($(this).find(":selected").val())
      })
      $('input.form-control.text').each(function(i){
        textArr.push($(this).val())
      })
      $('input.form-control.payload').each(function(i){
        payloadArr.push($(this).val())
      })
      event.preventDefault();
      const buttons = [];
      const position = 0;
      for (let i =0; i< textArr.length ; i++){
        const obj = {};        
        obj.type = payloadType[i];
        obj.title = textArr[i];
        if(obj.type === 'web_url'){
          obj.url = payloadArr[i];
        } else if (obj.type === 'postback'){
          obj.payload = payloadArr[i]
        }
        buttons.push(obj);
      }
      console.log('1923i102i30', buttons)
      const wellcomeMessageTextArea = $('#wellcomeMessageTextArea').val()
      // 
      // End 處理 ajax input datas
      // 
      
      fetch('/api/'+app.cst.apiVersion+'/webhook/wellcomeMessage',{
        method:'POST',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "data":
          {
            "message_type": "button",
            "text": wellcomeMessageTextArea,
            "buttons": buttons,
          },
            "position": position,
            "pageId": app.fb.pageId
        })
      })
      .then(res => res.json())
      .then((res) => {
        $('.form-control').prop('readonly', true);
        $('#wellcomeMessageEditButton').prop('disabled', false);
        $('div.form-row').each(function(){
          $('.addButtonTemplate').prop('disabled', true);
          $('.deleteButtonTemplate').prop('disabled', true);
          $('.payload-type').prop('disabled',true);
        })

        alert('儲存成功..........')
        console.log('fetch result:', res)
      })
      .catch((err) => {
        alert('儲存失敗..........')
        console.log('fetch error: ', err)
      }) // end of fetch
    }) // end of wellcomeMessageForm 處理

    // More Setting button
    $('.navMoreSetting').on('click',function () {
      // render 新增選項 
      console.log('1')

      delForm();
      $('#mainContentMoreSetting').append(addSets());
    })

    // 按下增加按鈕 (新增組數)
    $('#mainContentMoreSetting').on('click','#addNewSetButton', function () {
      const buttonType = $('#inlineFormCustomSelect').val()
      console.log('buttonType',buttonType)
      let html;
      if(buttonType === 'textResponse'){
        console.log('textResponse')
        app.moreSets.numberOfSet += 1;
        html += textResponse();
        $('#mainContentMoreSetting').prepend(textResponse());
      } else if (buttonType === 'buttonTemplate'){
        console.log('buttonTemplate')

      } else {
        alert('請選擇一種類型')
      }
      
    })

    // 操作 Up botton
    $('#mainContentMoreSetting').on('click','.upButton', function () {
      // 當前操作的父層編號
      const parentDiv = $(this).parent('form')
      // 當前操作的父層對應的上一個 div 中 index 編號
      const index = parseInt($(this).parent().attr("index"))
      const indexPre = parseInt($(this).parent().prev().attr("index"))
      console.log('index',index)
      console.log('indexPre',indexPre)
      // 判別是否是第一個 div , 如果 index 結果跑出 NaN, 代表前一個 div 沒有值了
      if(indexPre || indexPre === 0){
        // 交換 Index 編號
        parentDiv.attr("index",`${index-1}`)
        parentDiv.prev().attr("index",`${index}`)
        // 交換位置
        parentDiv.prev().insertAfter(parentDiv)  
      }
    })

    // 操作 Down botton
    $('#mainContentMoreSetting').on('click','.downButton', function () {
      // 當前操作的父層編號
      const parentDiv = $(this).parent('form')
      // 當前操作的父層對應的上一個 div 中 index 編號
      const index = parseInt($(this).parent().attr("index"))
      const indexNext = parseInt($(this).parent().next().attr("index"))
      console.log('indexPre',Boolean(indexNext))
      // 判別是否是第一個 div , 如果 index 結果跑出 NaN, 代表前一個 div 沒有值了
      if(indexNext){
        // 交換 Index 編號
        parentDiv.attr("index",`${index+1}`)
        parentDiv.next().attr("index",`${index}`)
        // 交換位置
        parentDiv.next().insertBefore(parentDiv) 
      }
    })
    // 操作 delete dutton - more setting 
    $('#mainContentMoreSetting').on('click','.deleteButton', function () {
      console.log('123')
      $(this).closest('.moreSettingDiv').remove();
      let a = $(this).parent().index('.moreSettingDiv')
      console.log('1234444',a)
    })

  })
}




// wellcome screen content
function wellcomeScreenContent(text){
  let html = `<form id="wellcomeMessageFormGreeting " class=" form-group delForm" >`
  html += `<label for="wellcomeMessageTextArea">Wellcome message - Greeting - 使用者第一次要開始聊天的時候會顯示的訊息</label>`
  if( text === 'NoData'){
    html += `<textarea class="form-control" id="wellcomeScreenTextArea" rows="10" placeholder="${text}" ></textarea>`
  } else {
    html += `<textarea class="form-control" id="wellcomeScreenTextArea" rows="10" readonly>${text}</textarea>`
  }
  html += `<button type="button" id="wellcomeScreenEditButton" class="btn btn-primary mb-2">Edit</button>`
  html += `</form>`
  return html
}


// wellcome message content 
// 下面邏輯考慮是否要從資料庫 render 資料進去
// 1. if info = "NoData" , 表示資料庫沒有資料
// 2. else , 表示資料庫有現成資料
function wellcomeMessageContent(info){
  let html = `<form id="wellcomeMessageForm " class=" form-group delForm" >`
  html += `<label>Button Template (下列 Button 選項需為 1~3 組)</label>`
  html += `<textarea class="form-control" id="wellcomeMessageTextArea" placeholder="Text" rows="1" readonly>`
  if(info !== 'NoData'){
    html += `${info.attachment.payload.text}`
  }
  html += `</textarea>`
  // 判斷 button 組數, 並且 render 進去
  for (let i=0; i< app.buttonTemplate.numberOfSet; i++){
    console.log('12323', info.attachment.payload.buttons[i].type)
    html += `<div class="form-row">`
    html += `<div class="col-3"><input type="text" class="form-control text" placeholder="Button Name" `
    if(info !== 'NoData'){
      html += `value="${info.attachment.payload.buttons[i].title}"`
    }
    html += `readonly ></div>`
    html += `<div class="col-3"><input type="text" class="form-control payload" placeholder="PostBack Name"`
    if(info !== 'NoData'){
      html += `value="${info.attachment.payload.buttons[i].payload}"`
    }
    html += `readonly ></div>`
    html += `<div class="col-1.5">`
    html += `<select class="payload-type custom-select mr-sm-2" id="inlineFormCustomSelect" >`
    // render to selected button
    html += `<option selected>按鈕類型</option>`
    if(info.attachment.payload.buttons[i].type === "postback"){
      html += `<option value="postback" selected="selected">回傳按鈕</option>`
      html += `<option value="web_url">url</option>`
    } else if (info.attachment.payload.buttons[i].type === "web_url"){
      html += `<option value="postback">回傳按鈕</option>`
      html += `<option value="web_url" selected="selected">url</option>`
    } else {
      html += `<option value="postback">回傳按鈕</option>`
      html += `<option value="web_url">url</option>`
    }
    html += `</select></div>`
    html += `<div class="col-1.5"><button type="button" id="addButtonTemplate" class="addButtonTemplate btn btn-primary btn-sm ">Add</button></div>`
    html += `<div class="col-1"><button type="button" id="deleteButtonTemplate" class="deleteButtonTemplate btn btn-primary btn-sm ">Delete</button></div>`
    html += `</div>`
  }
  if(info === 'NoData'){
    html += `<button type="submit" id="wellcomeMessageSubmitButton" class="btn btn-primary mb-2">Submit</button>`
  } else {
    html += `<button type="submit" id="wellcomeMessageEditButton" class="btn btn-primary mb-2 ">Edit</button>`
  }
  html += `</form>`
  return html
}

function addSets(){
  let html = `
    <form class="addNewSet delForm" >
    <button type="button" class="btn btn-primary" id="editFormButton" disabled >編輯表單</button>
    <button type="submit" class="btn btn-primary" id="submitFormButton">送出表單</button>
      <div class="form-row align-items-center">
        <label class="col-auto mr-sm-2" for="inlineFormCustomSelect">Button Type</label>
        <div class="col-auto my-1">
          <select class="custom-select mr-sm-2" id="inlineFormCustomSelect">
            <option selected>Button Type...</option>
            <option value="textResponse">回傳文字範本</option>
            <option value="buttonTemplate">回傳按鈕範本</option>
          </select>
        </div>
        <div class="col-auto my-1">
            <button type="button" class="btn btn-primary" id="addNewSetButton">增加</button>
        </div>
      </div>
    </form>`
  return html;
}

// 文字範本
function textResponse (){
  let html;
  let index = app.moreSets.numberOfSet;
  // 在 lib.js naming #index
  html = `<form class='moreSettingDiv' index=${index} class ="delForm">`
  html += `<div class="form-group">`
  html += `<label for="textResponse">Text Response</label>`
  html += `<input type="text" class="form-control" placeholder="接收到的 postback event name">`
  html += `<small class="form-text text-muted"></small>`
  html += `<input type="text" class="form-control" placeholder="接收到的 postback event name">`
  html += `<small class="form-text text-muted"></small>`
  html += `</div>`
  // html += `<button type="button" class="btn btn-primary EditButton">Edit</button>`
  // html += `<button type="button" class="btn btn-primary SubmitButton">Submit</button>`
  html += `<button type="button" class="btn btn-danger deleteButton">Delete</button>`
  html += `<button type="button" class="btn btn-success upButton">Up</button>`
  html += `<button type="button" class="btn btn-success downButton">Down</button>`
  html += `</form>`
  return html;
}



// 用來控制刪掉其他表單,再切換不同頁面的時候 
function delForm (){
  $('.delForm').each(function(){
    $(this).remove();
  })
}