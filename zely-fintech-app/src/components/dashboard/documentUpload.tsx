import React, { useState, useRef } from "react";
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileVideo,
  FileImage,
  XCircle,
} from "lucide-react";
import { kycService } from "../../services/kycService";
import { KYCDocumentType } from "../../types";

interface DocumentUploadProps {
  documentType: KYCDocumentType;
  label: string;
  description: string;
  onUploadSuccess: (url: string) => void;
  currentUrl?: string; // If already uploaded
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documentType,
  label,
  description,
  onUploadSuccess,
  currentUrl,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(
    currentUrl || null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccessUrl(null);
      setProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const signatureData = await kycService.getUploadSignature(documentType);

      if (file.size > signatureData.maxBytes) {
        throw new Error(
          `File is too large. Maximum size is ${Math.round(signatureData.maxBytes / (1024 * 1024))}MB.`,
        );
      }

      const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
      if (!signatureData.allowedFormats.includes(fileExtension)) {
        throw new Error(
          `Invalid format. Allowed formats: ${signatureData.allowedFormats.join(", ")}.`,
        );
      }

      const uploadResult = await kycService.uploadDocumentToCloudinary(
        file,
        signatureData,
        (p) => setProgress(p),
      );

      setSuccessUrl(uploadResult.secure_url);
      onUploadSuccess(uploadResult.secure_url);
    } catch (err: any) {
      setError(
        err.message || "An error occurred during upload. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  const isVideo = documentType === "LIVENESS_VIDEO";

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-white dark:bg-slate-900 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase mb-1">
            {label}
          </h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <div
          className={`p-2 rounded-xl ${successUrl ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}
        >
          {successUrl ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : isVideo ? (
            <FileVideo className="w-5 h-5" />
          ) : (
            <FileImage className="w-5 h-5" />
          )}
        </div>
      </div>

      {!successUrl && !uploading && (
        <div className="space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
            accept={
              isVideo
                ? "video/mp4,video/quicktime,video/webm"
                : "image/jpeg,image/png"
            }
          />

          {!file ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-primary hover:bg-primary/5 transition-colors group cursor-pointer"
            >
              <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-primary mb-2 transition-colors" />
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors">
                Select {isVideo ? "Video" : "Image"}
              </span>
              <span className="text-xs text-slate-400 mt-1">
                {isVideo ? "MP4, MOV, WEBM (Max 25MB)" : "JPG, PNG (Max 5MB)"}
              </span>
            </button>
          ) : (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
                  {isVideo ? (
                    <FileVideo className="w-4 h-4" />
                  ) : (
                    <FileImage className="w-4 h-4" />
                  )}
                </div>
                <div className="truncate">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {file && (
            <button
              type="button"
              onClick={handleUpload}
              className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
            >
              Upload Document
            </button>
          )}
        </div>
      )}

      {uploading && (
        <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-primary animate-spin"></div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Uploading {progress}%
          </p>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          {isVideo && progress < 100 && (
            <p className="text-xs text-slate-500 text-center mt-2">
              Video uploads can take a moment. Please keep the app open.
            </p>
          )}
        </div>
      )}

      {successUrl && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-green-800 dark:text-green-400">
                Upload Successful
              </p>
              <p className="text-xs text-green-600/80 dark:text-green-500">
                Document securely stored.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSuccessUrl(null);
              setFile(null);
            }}
            className="text-xs font-bold text-green-700 hover:text-green-800 dark:text-green-500 dark:hover:text-green-400 flex items-center gap-1 transition-colors"
          >
            <UploadCloud className="w-3 h-3" /> Re-upload document
          </button>
        </div>
      )}
    </div>
  );
};
