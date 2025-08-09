// app/status/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface ServiceStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'testing' | 'unknown';
  message?: string;
  timestamp?: string;
}

export default function StatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { service: 'Gemini API', status: 'testing' },
    { service: 'Vercel Deployment', status: 'healthy' },
    { service: 'Environment Variables', status: 'testing' },
  ]);

  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    testServices();
  }, []);

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const updateServiceStatus = (service: string, status: ServiceStatus['status'], message?: string) => {
    setServices(prev => prev.map(s => 
      s.service === service 
        ? { ...s, status, message, timestamp: new Date().toISOString() }
        : s
    ));
  };

  const testServices = async () => {
    addLog('Starting service tests...');

    // Test Gemini API
    try {
      addLog('Testing Gemini API...');
      const response = await fetch('/api/test-gemini');
      const data = await response.json();
      
      if (data.status === 'success') {
        updateServiceStatus('Gemini API', 'healthy', 'API responding correctly');
        addLog('✅ Gemini API test passed');
      } else {
        updateServiceStatus('Gemini API', 'unhealthy', data.error || 'Unknown error');
        addLog('❌ Gemini API test failed');
      }
    } catch (error) {
      updateServiceStatus('Gemini API', 'unhealthy', 'Connection failed');
      addLog('❌ Gemini API connection error');
    }

    // Test environment variables
    const envVars = ['GOOGLE_GEMINI_API_KEY'];
    const missingVars = envVars.filter(v => !process.env[`NEXT_PUBLIC_${v}`]);
    
    if (missingVars.length === 0) {
      updateServiceStatus('Environment Variables', 'healthy', 'All required variables present');
      addLog('✅ Environment variables configured');
    } else {
      updateServiceStatus('Environment Variables', 'unhealthy', `Missing: ${missingVars.join(', ')}`);
      addLog('⚠️ Some environment variables may be missing');
    }

    addLog('Service tests completed');
  };

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'unhealthy':
        return <XCircle className="text-red-500" size={20} />;
      case 'testing':
        return <Clock className="text-yellow-500" size={20} />;
      default:
        return <AlertTriangle className="text-gray-500" size={20} />;
    }
  };

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return 'border-green-200 bg-green-50';
      case 'unhealthy':
        return 'border-red-200 bg-red-50';
      case 'testing':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Docebo AI Agent - System Status
          </h1>
          <p className="text-gray-600 mb-4">
            Deployment and service health monitoring
          </p>
          
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Live monitoring</span>
          </div>
        </div>

        {/* Service Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {services.map((service) => (
            <div
              key={service.service}
              className={`p-4 rounded-lg border-2 ${getStatusColor(service.status)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-800">{service.service}</h3>
                {getStatusIcon(service.status)}
              </div>
              <p className="text-sm text-gray-600 capitalize">
                Status: {service.status}
              </p>
              {service.message && (
                <p className="text-xs text-gray-500 mt-1">{service.message}</p>
              )}
              {service.timestamp && (
                <p className="text-xs text-gray-400 mt-1">
                  Last checked: {new Date(service.timestamp).toLocaleTimeString()}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={testServices}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              🔄 Retest Services
            </button>
            <button
              onClick={() => window.open('/api/test-gemini', '_blank')}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              🧪 Test Gemini API
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
            >
              🚀 Launch Chat Interface
            </button>
          </div>
        </div>

        {/* Recent Logs */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm max-h-40 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">No recent activity...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">
            🎯 Next Steps
          </h2>
          <ul className="text-blue-700 space-y-1">
            <li>✅ Verify all services show "healthy" status</li>
            <li>⏳ Set up Docebo API credentials</li>
            <li>⏳ Configure Supabase database</li>
            <li>⏳ Deploy chat interface</li>
            <li>⏳ Test end-to-end functionality</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
