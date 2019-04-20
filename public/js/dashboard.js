let accessToken = app.getCookie('Authorization');


app.init = function (){
  let id = app.getParameter("id");
  if(!id){
    window.location="./";
  }
  app.fb.pageId = id;
}

function callback(){
  app.init();
  $(function(){
    $('.navWellcomeMessageGreeting').on('click',function(){
      console.log('123')
      $('#wellcomeMessageFormGreeting').show();
      $('#wellcomeMessageForm').hide();
    });

    // wellcome message 處理
    $('.navWellcomeMessage').on('click',function(){
      console.log('123')
      $('#wellcomeMessageFormGreeting').hide();
      $('#wellcomeMessageForm').show();

    });

    // wellcome screen 處理
    $('#wellcomeMessageFormGreeting').submit(function(event){
      const textArea = $('#wellcomeScreenTextArea').val();
      $('#wellcomeScreenButton').attr('disabled', true);
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
        console.log('fetch result:', res)
      })
      .catch((err) => { 
        console.log('fetch error: ', err)
      })
    }) // end of wellcome screen 處理

    // wellcome message 處理
    $('#wellcomeMessageForm').submit(function (event) {
      const buttons = [];
      const position = 0;
      for (let i =0; i<3 ; i++){
        const obj = {};        
        let text = $(`.text-${i+1}`).val()
        let payload = $(`.payload-${i+1}`).val()
        // console.log('text ',i,':',text)
        // console.log('payload ',i,':',payload)
        obj.text = text;
        obj.payload = payload;
        buttons.push(obj);
      }
      const wellcomeMessageTextArea = $('#wellcomeMessageTextArea').val()
      console.log('999', buttons); 
      console.log('888', $('#wellcomeMessageTextArea').val())
      event.preventDefault();
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

$(document).ready(callback);




