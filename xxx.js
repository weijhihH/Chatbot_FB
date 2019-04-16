async function a (){
  const b = await c(4)
  console.log(b);

}
function c (d){
	return new Promise((resolve) => {
    resolve(d)}
  )
}

a();