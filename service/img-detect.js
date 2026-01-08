const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function requestImagga(filePath) {
  // Create form data to send request to API
  const fd = new FormData();
  fd.append('image', fs.createReadStream(filePath));

  // Imagga URLs and API options
  const url = 'https://api.imagga.com';
  const APIs = {
    "img-tag": "/v2/tags", 
    // image - file (multipart/form-data)
    "category": "/v2/categorizers/general_v3",
    // categorizer_id - string (required)
    // image - file (Binary image file via multipart/form-data)
    "face-detect": "/v2/faces/detections",
    // image - file (Binary image file via multipart/form-data)
    // return_face_id - boolean (generate face_id for each detected face)
    "text-recog": "/v2/text",
    // image - file (Image file contents to perform optical character recognition)
  };

  const apiOption = APIs['img-tag'];

  console.log("Sending image to Imagga...");
 
  const headers = {
    'Authorization': process.env.IMAGGA_HEADER,
    ...fd.getHeaders() // For multipart/form-data requirement
  }

  try {
    const resp = await axios.post(`${url}${apiOption}`, fd, { headers });
    return resp.data;
  } catch (error) {
    return `Error requesting Imagga: ${error.response ? error.response.data : error.message}`;
    // console.error('Error uploading image:', error.response ? error.response.data : error.message);
  }
}

module.exports = { requestImagga };