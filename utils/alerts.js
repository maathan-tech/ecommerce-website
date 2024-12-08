exports.successAlert = (message) => {
    return `Swal.fire('Success', '${message}', 'success')`;
  };
  
  exports.errorAlert = (message) => {
    return `Swal.fire('Error', '${message}', 'error')`;
  };