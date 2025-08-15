// components/CSVUpload.tsx - Enhanced CSV Upload with validity dates and assignment types
'use client';

import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Download,
  Users,
  BookOpen,
  Eye,
  Play,
  Calendar,
  Clock
} from 'lucide-react';

interface CSVData {
  headers: string[];
  rows: string[][];
  totalRows: number;
  validRows: string[][];
  invalidRows: Array<{ row: string[]; errors: string[]; index: number }>;
}

interface CSVUploadProps {
  onProcessCSV: (data: { operation: string; data: CSVData }) => void;
  isProcessing?: boolean;
}

const CSVUpload: React.FC<CSVUploadProps> = ({ onProcessCSV, isProcessing = false }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [operation, setOperation] = useState<'course_enrollment' | 'lp_enrollment' | 'unenrollment'>('course_enrollment');
  const [showPreview, setShowPreview] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateCSV = useCallback((headers: string[], rows: string[][], operationType: string): CSVData => {
    const validRows: string[][] = [];
    const invalidRows: Array<{ row: string[]; errors: string[]; index: number }> = [];

    // Define required columns based on operation (enhanced with validity dates)
    const requiredColumns = {
      course_enrollment: ['email', 'course'],
      lp_enrollment: ['email', 'learning_plan'],
      unenrollment: ['email', 'resource']
    };

    // Define optional columns (enhanced)
    const optionalColumns = {
      course_enrollment: ['assignment_type', 'start_validity', 'end_validity'],
      lp_enrollment: ['assignment_type', 'start_validity', 'end_validity'],
      unenrollment: ['resource_type']
    };

    const required = requiredColumns[operationType as keyof typeof requiredColumns];
    const optional = optionalColumns[operationType as keyof typeof optionalColumns] || [];
    const headerLower = headers.map(h => h.toLowerCase().trim());

    // Check if all required columns exist
    const missingColumns = required.filter(col => !headerLower.includes(col));
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    // Get column indices
    const emailIndex = headerLower.indexOf('email');
    const resourceIndex = headerLower.indexOf(required[1]);
    const assignmentTypeIndex = headerLower.indexOf('assignment_type');
    const startValidityIndex = headerLower.indexOf('start_validity');
    const endValidityIndex = headerLower.indexOf('end_validity');
    const resourceTypeIndex = headerLower.indexOf('resource_type');

    rows.forEach((row, index) => {
      const errors: string[] = [];
      
      // Validate email
      const email = row[emailIndex]?.trim();
      if (!email) {
        errors.push('Email is required');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Invalid email format');
      }

      // Validate resource (course/learning_plan/resource)
      const resource = row[resourceIndex]?.trim();
      if (!resource) {
        errors.push(`${required[1].replace('_', ' ')} is required`);
      }

      // Validate assignment type (if provided)
      if (assignmentTypeIndex >= 0 && row[assignmentTypeIndex]) {
        const assignmentType = row[assignmentTypeIndex]?.trim().toLowerCase();
        if (assignmentType && !['required', 'optional'].includes(assignmentType)) {
          errors.push('Assignment type must be "required" or "optional"');
        }
      }

      // Validate start validity date (if provided)
      if (startValidityIndex >= 0 && row[startValidityIndex]) {
        const startDate = row[startValidityIndex]?.trim();
        if (startDate && !isValidDate(startDate)) {
          errors.push('Start validity must be a valid date (YYYY-MM-DD format)');
        }
      }

      // Validate end validity date (if provided)
      if (endValidityIndex >= 0 && row[endValidityIndex]) {
        const endDate = row[endValidityIndex]?.trim();
        if (endDate && !isValidDate(endDate)) {
          errors.push('End validity must be a valid date (YYYY-MM-DD format)');
        }
        
        // Check that end date is after start date
        if (startValidityIndex >= 0 && row[startValidityIndex] && endDate && isValidDate(endDate)) {
          const startDate = row[startValidityIndex]?.trim();
          if (startDate && isValidDate(startDate) && new Date(endDate) <= new Date(startDate)) {
            errors.push('End validity must be after start validity');
          }
        }
      }

      // Validate resource type for unenrollment (if provided)
      if (operationType === 'unenrollment' && resourceTypeIndex >= 0 && row[resourceTypeIndex]) {
        const resourceType = row[resourceTypeIndex]?.trim().toLowerCase();
        if (resourceType && !['course', 'learning_plan'].includes(resourceType)) {
          errors.push('Resource type must be "course" or "learning_plan"');
        }
      }

      if (errors.length > 0) {
        invalidRows.push({ row, errors, index: index + 1 });
      } else {
        validRows.push(row);
      }
    });

    return {
      headers,
      rows,
      totalRows: rows.length,
      validRows,
      invalidRows
    };
  }, []);

  const isValidDate = (dateString: string): boolean => {
    // Check YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  };

  const parseCSV = useCallback((text: string): { headers: string[]; rows: string[][] } => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => 
      line.split(',').map(cell => cell.trim().replace(/"/g, ''))
    );

    return { headers, rows };
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('File size must be less than 5MB');
      return;
    }

    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      const validatedData = validateCSV(headers, rows, operation);
      
      setCsvData(validatedData);
      setFileName(file.name);
      setShowPreview(true);
    } catch (error) {
      alert(`Error parsing CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [parseCSV, validateCSV, operation]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleProcessClick = () => {
    if (csvData) {
      onProcessCSV({ operation, data: csvData });
    }
  };

  const downloadTemplate = () => {
    const templates = {
      course_enrollment: `email,course,assignment_type,start_validity,end_validity
john@company.com,Python Programming,required,2024-01-15,2024-12-31
sarah@company.com,Data Science Basics,optional,2024-02-01,2024-11-30
mike@company.com,Excel Advanced,required,2024-01-01,2024-06-30`,

      lp_enrollment: `email,learning_plan,assignment_type,start_validity,end_validity
john@company.com,Leadership Development,required,2024-01-15,2024-12-31
sarah@company.com,Technical Skills,optional,2024-02-01,2024-11-30
mike@company.com,Management Training,required,2024-01-01,2024-06-30`,

      unenrollment: `email,resource,resource_type
john@company.com,Old Training Course,course
sarah@company.com,Outdated Learning Path,learning_plan
mike@company.com,Deprecated Program,course`
    };

    const content = templates[operation];
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${operation}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetUpload = () => {
    setCsvData(null);
    setFileName('');
    setShowPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Operation Selector */}
      <div className="bg-white p-4 rounded-lg border">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">CSV Bulk Operation</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => setOperation('course_enrollment')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              operation === 'course_enrollment'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <BookOpen className="w-5 h-5 mx-auto mb-2" />
            <div className="font-medium">Course Enrollment</div>
            <div className="text-xs text-gray-500 mt-1">Enroll users in courses</div>
            <div className="flex items-center justify-center mt-2 space-x-2">
              <Calendar className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400">With validity dates</span>
            </div>
          </button>
          
          <button
            onClick={() => setOperation('lp_enrollment')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              operation === 'lp_enrollment'
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Users className="w-5 h-5 mx-auto mb-2" />
            <div className="font-medium">Learning Plan Enrollment</div>
            <div className="text-xs text-gray-500 mt-1">Enroll users in learning plans</div>
            <div className="flex items-center justify-center mt-2 space-x-2">
              <Calendar className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400">With validity dates</span>
            </div>
          </button>
          
          <button
            onClick={() => setOperation('unenrollment')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              operation === 'unenrollment'
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <X className="w-5 h-5 mx-auto mb-2" />
            <div className="font-medium">Unenrollment</div>
            <div className="text-xs text-gray-500 mt-1">Remove users from resources</div>
            <div className="flex items-center justify-center mt-2 space-x-2">
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400">Immediate removal</span>
            </div>
          </button>
        </div>
      </div>

      {/* File Upload Area */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-medium text-gray-900">Upload CSV File</h4>
          <button
            onClick={downloadTemplate}
            className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <Download className="w-4 h-4" />
            <span>Download Template</span>
          </button>
        </div>

        {!csvData ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <div className="text-lg font-medium text-gray-700 mb-2">
              Drop your CSV file here, or click to browse
            </div>
            <div className="text-sm text-gray-500 mb-4">
              Maximum file size: 5MB
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse Files
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Info */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-gray-500" />
                <div>
                  <div className="font-medium text-gray-900">{fileName}</div>
                  <div className="text-sm text-gray-500">
                    {csvData.totalRows} rows • {csvData.validRows.length} valid • {csvData.invalidRows.length} invalid
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  <Eye className="w-4 h-4" />
                  <span>{showPreview ? 'Hide' : 'Preview'}</span>
                </button>
                <button
                  onClick={resetUpload}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4" />
                  <span>Remove</span>
                </button>
              </div>
            </div>

            {/* Validation Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <div className="font-medium text-green-800">Valid Rows</div>
                  <div className="text-sm text-green-600">{csvData.validRows.length} rows ready for processing</div>
                </div>
              </div>
              
              {csvData.invalidRows.length > 0 && (
                <div className="flex items-center space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <div>
                    <div className="font-medium text-yellow-800">Invalid Rows</div>
                    <div className="text-sm text-yellow-600">{csvData.invalidRows.length} rows have errors</div>
                  </div>
                </div>
              )}
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="space-y-4">
                {/* Valid Rows Preview */}
                {csvData.validRows.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-green-800 mb-2">Valid Rows (first 5)</h5>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-green-50">
                            {csvData.headers.map((header, index) => (
                              <th key={index} className="px-3 py-2 text-left font-medium text-green-800 border">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvData.validRows.slice(0, 5).map((row, index) => (
                            <tr key={index} className="border-b">
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="px-3 py-2 border text-gray-700">
                                  {cell || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Invalid Rows Preview */}
                {csvData.invalidRows.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-red-800 mb-2">Invalid Rows (first 5)</h5>
                    <div className="space-y-2">
                      {csvData.invalidRows.slice(0, 5).map((invalidRow, index) => (
                        <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                          <div className="text-sm font-medium text-red-800 mb-1">
                            Row {invalidRow.index}: {invalidRow.errors.join(', ')}
                          </div>
                          <div className="text-xs text-red-600">
                            {invalidRow.row.join(' | ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Process Button */}
            {csvData.validRows.length > 0 && (
              <div className="flex justify-between items-center pt-4">
                <div className="text-sm text-gray-600">
                  Ready to process {csvData.validRows.length} valid row{csvData.validRows.length !== 1 ? 's' : ''}
                </div>
                <button
                  onClick={handleProcessClick}
                  disabled={isProcessing}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>{isProcessing ? 'Processing...' : 'Process CSV'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enhanced Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h5 className="font-medium text-blue-800 mb-2">Enhanced CSV Format Requirements</h5>
        <div className="text-sm text-blue-700 space-y-2">
          {operation === 'course_enrollment' && (
            <div className="space-y-1">
              <div>• <strong>Required columns:</strong> email, course</div>
              <div>• <strong>Optional columns:</strong> assignment_type (required/optional), start_validity (YYYY-MM-DD), end_validity (YYYY-MM-DD)</div>
              <div>• <strong>Example:</strong> john@company.com, Python Programming, required, 2024-01-15, 2024-12-31</div>
              <div>• <strong>Validity dates:</strong> Control when enrollment becomes active and expires</div>
            </div>
          )}
          {operation === 'lp_enrollment' && (
            <div className="space-y-1">
              <div>• <strong>Required columns:</strong> email, learning_plan</div>
              <div>• <strong>Optional columns:</strong> assignment_type (required/optional), start_validity (YYYY-MM-DD), end_validity (YYYY-MM-DD)</div>
              <div>• <strong>Example:</strong> sarah@company.com, Leadership Development, required, 2024-02-01, 2024-11-30</div>
              <div>• <strong>Validity dates:</strong> Control when learning plan access becomes active and expires</div>
            </div>
          )}
          {operation === 'unenrollment' && (
            <div className="space-y-1">
              <div>• <strong>Required columns:</strong> email, resource</div>
              <div>• <strong>Optional columns:</strong> resource_type (course/learning_plan)</div>
              <div>• <strong>Example:</strong> mike@company.com, Old Training Course, course</div>
              <div>• <strong>Note:</strong> Unenrollment is immediate and doesn't use validity dates</div>
            </div>
          )}
          <div className="pt-2 border-t border-blue-200 space-y-1">
            <div>• <strong>Date format:</strong> YYYY-MM-DD (e.g., 2024-01-15)</div>
            <div>• <strong>Headers are case-insensitive</strong></div>
            <div>• <strong>Maximum 1000 rows per file</strong></div>
            <div>• <strong>End validity must be after start validity</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CSVUpload;
