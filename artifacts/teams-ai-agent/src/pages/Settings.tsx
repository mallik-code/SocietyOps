import React, { useState, useEffect } from "react";
import { useGetLlmSettings, useUpdateLlmSettings, useTestLlmConnection } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export function Settings() {
  const { data: settings, isLoading, refetch } = useGetLlmSettings();
  const updateMutation = useUpdateLlmSettings();
  const testMutation = useTestLlmConnection();
  const { toast } = useToast();

  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");

  useEffect(() => {
    if (settings) {
      setProvider(settings.provider);
      setModel(settings.model);
    }
  }, [settings]);

  const handleSave = () => {
    updateMutation.mutate({
      data: { provider, model, api_key: apiKey ? apiKey : undefined }
    }, {
      onSuccess: () => {
        toast({ title: "Settings saved", description: "LLM settings have been updated." });
        setApiKey("");
        refetch();
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "Failed to save settings." });
      }
    });
  };

  const handleTest = () => {
    testMutation.mutate(undefined, {
      onSuccess: (res) => {
        if (res.success) {
          toast({ title: "Connection Successful", description: `Latency: ${res.latency_ms}ms` });
        } else {
          toast({ variant: "destructive", title: "Connection Failed", description: res.message });
        }
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "Could not perform connection test." });
      }
    });
  };

  if (isLoading) return <div className="animate-pulse">Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">LLM Configuration</h2>
        <p className="text-muted-foreground mt-1">Configure the intelligence engine powering the agent.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider Settings</CardTitle>
          <CardDescription>Select your LLM provider and specify the model to use.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Provider</label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-4o" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center justify-between">
              API Key
              {settings?.api_key_set && <Badge variant="secondary" className="text-xs">Configured</Badge>}
            </label>
            <Input 
              type="password" 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)} 
              placeholder={settings?.api_key_set ? "••••••••••••••••" : "Enter API key"} 
            />
            <p className="text-xs text-muted-foreground">Only provide a key if you wish to update the existing one.</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t border-border pt-4">
          <Button variant="outline" onClick={handleTest} disabled={testMutation.isPending}>
            {testMutation.isPending ? "Testing..." : "Test Connection"}
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
