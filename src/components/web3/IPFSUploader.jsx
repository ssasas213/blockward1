import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2, CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function IPFSUploader() {
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [metadata, setMetadata] = useState({
    name: '',
    description: '',
    category: ''
  });
  const [uploadedURI, setUploadedURI] = useState('');

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const handleUploadToIPFS = async () => {
    if (!imageFile || !metadata.name) {
      toast.error('Please provide image and name');
      return;
    }

    setUploading(true);
    try {
      // In production: Upload to Pinata or other IPFS service
      // 1. Upload image file
      // 2. Create metadata JSON with image IPFS URL
      // 3. Upload metadata JSON
      // 4. Return metadata IPFS URL

      // Mock upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockImageHash = 'Qm' + Math.random().toString(36).substr(2, 44);
      const mockMetadataHash = 'Qm' + Math.random().toString(36).substr(2, 44);
      
      const metadataJSON = {
        name: metadata.name,
        description: metadata.description,
        image: `ipfs://${mockImageHash}`,
        attributes: [
          { trait_type: 'Category', value: metadata.category }
        ]
      };

      const uri = `ipfs://${mockMetadataHash}`;
      setUploadedURI(uri);
      toast.success('Uploaded to IPFS!');
    } catch (error) {
      toast.error('Upload failed');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(uploadedURI);
    toast.success('URI copied!');
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>IPFS Uploader</CardTitle>
        <CardDescription>Upload NFT metadata to IPFS</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {uploadedURI ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload Successful!</h3>
            <div className="bg-slate-50 p-4 rounded-lg mb-4">
              <p className="text-xs text-slate-500 mb-2">IPFS URI:</p>
              <p className="font-mono text-sm break-all">{uploadedURI}</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={copyToClipboard} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Copy URI
              </Button>
              <Button onClick={() => {
                setUploadedURI('');
                setImageFile(null);
                setMetadata({ name: '', description: '', category: '' });
              }}>
                Upload Another
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>NFT Image</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
              />
              {imageFile && (
                <p className="text-xs text-slate-500">{imageFile.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={metadata.name}
                onChange={(e) => setMetadata({ ...metadata, name: e.target.value })}
                placeholder="Achievement name"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={metadata.description}
                onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                placeholder="Describe the achievement..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                value={metadata.category}
                onChange={(e) => setMetadata({ ...metadata, category: e.target.value })}
                placeholder="e.g. Academic, Sports"
              />
            </div>

            <Button
              onClick={handleUploadToIPFS}
              disabled={!imageFile || !metadata.name || uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading to IPFS...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload to IPFS
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}