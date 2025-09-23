import React, { useState } from 'react'

const PRESIGN_API = 'http://localhost:5055/presign'
export default function App() {
  const [ selectedFile, setSelectedFile ] = useState<File | null >(null);
  const [ uploading, setUploading ] = useState<boolean>(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file  = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const  handleUpload = async() => {
    if (!selectedFile) return;
    setUploading(true);
    try{
      console.log(`Upload started for file: ${selectedFile.name}`);

      const presignResponse = await fetch(PRESIGN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size
        })
      });
      
      const { presignedUrl } =  await presignResponse.json();

      const uploadResponse = await fetch( presignedUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type
        }
      })

      if (uploadResponse.ok){
        console.log('Upload complete');
      }
    }catch (error){
      console.log('Upload failed:', error)
    } finally{
      setUploading(true)
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '48px auto' }}>
      <h1>Doc Intake & Search</h1>
      <input 
       type="file"
       onChange={handleFileSelect}
      />
      <button onClick={handleUpload}>Upload</button>
    </div>
  )
}
