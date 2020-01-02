const requiredFields = ['artistName', 'title', 'category', 'tags'];
const validateFields = (fieldsObject) => {
  return new Promise(function(resolve, reject) {
    for (let i = 0; i < requiredFields.length; i++) {
      const field = requiredFields[i];
      if (!(field in fieldsObject)) {
        const message = `Missing \`${field}\` in request body`;
        console.log('validateFields is sending a reject message', message);
        reject(message);
      }
    }
    //console.log('validateFields is sending a resolve object', fieldsObject);
    resolve(fieldsObject);
  })
}

module.exports = {validateFields}
