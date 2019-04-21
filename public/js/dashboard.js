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

    // wellcome message button 處理
    $('.navWellcomeMessage').on('click',function(){
      fetch('/api/'+app.cst.apiVersion+'/webhook/wellcomeMessage/getInformation?pageId='+app.fb.pageId+'&payload=getStarted',{
        method:'GET',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
        }
      }).then(res => res.json())
      .then((res) => {
        let info = JSON.parse(res.data.info)
        console.log(info);

        $('#mainContent').append(wellcomeMessageContent());
        $('#wellcomeMessageFormGreeting').hide(); 
        $('#wellcomeMessageForm').show();
      })
      .catch((err) => {
        console.log('err');
      })

    });

    // 處理 Wellcome sreen button 
    $('.navWellcomeMessageGreeting').on('click',function(){
      fetch('/api/'+app.cst.apiVersion+'/webhook/greeting/getInformation?pageId='+app.fb.pageId,{
        method:'GET',
        headers:{
          'Authorization': 'Bearer '+ accessToken,
        }
      })
      .then(res => res.json())
      .then((res) => {
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
    // 控制 Wellcome Message 內的 Add and Delete Button
    $('#mainContent').on("click","#addButtonTemplate", function () {
      if(app.buttonTemplate.numberOfSet < 3) {
        app.buttonTemplate.numberOfSet += 1
        console.log('app.buttonTemplate.numberOfSet',app.buttonTemplate.numberOfSet)
        let html = `<div class="form-row ">`
        html += `<div class="col-4"><input type="text" class="form-control text" placeholder="按鈕名稱"></div>`
        html += `<div class="col-4"><input type="text" class="form-control payload" placeholder="回覆按鈕"></div>`
        html += `<div class="col-1.5"><button type="button" id="addButtonTemplate" class="btn btn-primary mb-2 addButton-${app.buttonTemplate.numberOfSet}">Add</button></div>`
        html += `<div class="col-1"><button type="button" id="deleteButtonTemplate" class="btn btn-primary mb-2 deleteButton-${app.buttonTemplate.numberOfSet}">Delete</button></div>`
        html += `</div>`
        // $(`div.form-row.block-${app.buttonTemplate.numberOfSet -1}`).after(html)
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
    $('#mainContent').on("submit", "#wellcomeMessageFormGreeting", function (event) {
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

    

    // wellcome message 處理
    $('#mainContent').on("submit",'#wellcomeMessageForm',function(){
      let textArr = [];
      let payloadArr = [];
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
        console.log(i)
        const obj = {};        
        obj.type = 'postback';
        obj.title = textArr[i];
        obj.payload = payloadArr[i];
        buttons.push(obj);
      }
      console.log(buttons);
      const wellcomeMessageTextArea = $('#wellcomeMessageTextArea').val()
      
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
        console.log('fetch result:', res)
      })
      .catch((err) => {
        console.log('fetch error: ', err)
      }) // end of fetch
    }) // end of wellcomeMessageForm 處理
  })


}


// wellcome screen content
function wellcomeScreenContent(text){
  let html = `<form id="wellcomeMessageFormGreeting" class=" form-group" >`
  html += `<label for="wellcomeMessageTextArea">Wellcome message - Greeting - 使用者第一次要開始聊天的時候會顯示的訊息</label>`
  if( text === 'NoData'){
    html += `<textarea class="form-control" id="wellcomeScreenTextArea" rows="10" placeholder="${text}" ></textarea>`
    html += `<button type="submit" id="wellcomeScreenSubmitButton" class="btn btn-primary mb-2">Submit</button>`
  } else {
    html += `<textarea class="form-control" id="wellcomeScreenTextArea" rows="10" readonly>${text}</textarea>`
    html += `<button type="button" id="wellcomeScreenEditButton" class="btn btn-primary mb-2">Edit</button>`
  }
  html += `</form>`
  return html
}


// wellcome message content 
function wellcomeMessageContent(response){
  let text = response
  let html = `<form id="wellcomeMessageForm" class=" form-group" >`
  html += `<label>Wellcome message</label>`
  html += `<textarea class="form-control" id="wellcomeMessageTextArea" placeholder="Text" rows="1" ></textarea> `
  html += `<div class="form-row block-1">`
  html += `<div class="col-4"><input type="text" class="form-control text" placeholder="按鈕名稱"></div>`
  html += `<div class="col-4"><input type="text" class="form-control payload" placeholder="回覆按鈕"></div>`
  html += `<div class="col-1.5"><button type="button" id="addButtonTemplate" class="btn btn-primary mb-2 addButton-1">Add</button></div>`
  html += `<div class="col-1"><button type="button" id="deleteButtonTemplate" class="btn btn-primary mb-2 deleteButton-1">Delete</button></div>`
  html += `</div>`
  html += `<button type="submit" id="wellcomeMessageButton" class="btn btn-primary mb-2">Submit</button>`
  html += `</form>`
  return html
}
