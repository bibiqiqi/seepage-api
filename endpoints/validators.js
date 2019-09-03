const requiredFields = ['artistName', 'title', 'category', 'tags'];
const validateFields = fieldsObject => {
  return new Promise(function(resolve, reject) {
    for (let i = 0; i < requiredFields.length; i++) {
      const field = requiredFields[i];
      if (!(field in fieldsObject)) {
        const message = `Missing \`${field}\` in request body`;
        console.error(message);
        // TODO: send error message to server
        reject(message);
      }
    }
    resolve(fieldsObject);
  })
}

module.exports = {validateFields}