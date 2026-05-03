import { useState, useEffect, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useGetWhatsappQr,
  useGetWhatsappConnectStatus,
  useLogoutWhatsapp,
  useGetTelegramStatus,
  useSetupTelegram,
  useGetTelegramQr,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  MessageCircle,
  Send,
  CheckCircle2,
  XCircle,
  RefreshCw,
  LogOut,
  Wifi,
  WifiOff,
  KeyRound,
  Link2,
  AlertCircle,
  Trash2,
  Loader2,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";

interface ConnectPageProps {
  isDark: boolean;
}

function StatusBadge({ connected, label }: { connected: boolean; label?: string }) {
  return (
    <Badge
      className={`gap-1 text-xs ${
        connected
          ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-100"
          : "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900 dark:text-orange-100"
      }`}
    >
      {connected ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
      {label ?? (connected ? "Connected" : "Not connected")}
    </Badge>
  );
}

function QrImage({ src, size = 240 }: { src: string; size?: number }) {
  return (
    <div
      className="rounded-xl p-3 bg-white border border-border inline-block"
      style={{ lineHeight: 0 }}
    >
      <img src={src} alt="QR code" width={size} height={size} className="rounded-lg" />
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ── WhatsApp panel ────────────────────────────────────────────────────────────
function WhatsAppPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [polling, setPolling] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: status, isLoading: statusLoading } = useGetWhatsappConnectStatus({
    query: { refetchInterval: polling ? 5000 : false },
  });

  const { data: qrData, isLoading: qrLoading, refetch: refetchQr } = useGetWhatsappQr({
    query: { enabled: status?.connected === false, refetchInterval: polling ? 30000 : false },
  });

  const { mutate: logout, isPending: logoutPending } = useLogoutWhatsapp({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries();
        toast({ title: "WhatsApp disconnected" });
      },
    },
  });

  // Stop polling once connected
  useEffect(() => {
    if (status?.connected) setPolling(false);
    else setPolling(true);
  }, [status?.connected]);



  const connected = status?.connected ?? false;

  return (
    <div className="space-y-4">
      {/* Status card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                  Evolution API Instance
                  {statusLoading ? (
                    <Skeleton className="h-4 w-20 inline-block" />
                  ) : (
                    <StatusBadge connected={connected} label={connected ? "Connected" : status?.state ?? "Unknown"} />
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {status?.instance ?? "building-mgmt-wa"} — {status?.api_url ?? "—"}
                </div>
                {connected && status?.phone && (
                  <div className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                    <Wifi className="w-3 h-3" /> Paired with {status.phone}
                  </div>
                )}
              </div>
            </div>
            {connected && (
              <button
                onClick={() => logout({})}
                disabled={logoutPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm text-destructive hover:bg-destructive/5 transition-colors"
              >
                {logoutPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                Disconnect
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {!connected ? (
        /* QR pairing section */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pair via QR Code</CardTitle>
            <CardDescription className="text-sm">
              Open WhatsApp on your phone → Linked Devices → Link a Device, then scan this QR code.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-5 pt-0 pb-6">
            {qrLoading ? (
              <Skeleton className="w-[258px] h-[258px] rounded-xl" />
            ) : qrData?.qr_data_url ? (
              <>
                <QrImage src={qrData.qr_data_url} />
                <div className="text-xs text-muted-foreground text-center">
                  QR refreshes every 60 seconds.{" "}
                  <button onClick={() => refetchQr()} className="underline hover:text-foreground">
                    Refresh now
                  </button>
                </div>
                <div className="w-full rounded-lg bg-muted px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground font-mono truncate">
                    {qrData.pairing_token}
                  </span>
                  <CopyButton value={qrData.pairing_token} />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="w-4 h-4" /> Failed to load QR code
              </div>
            )}


          </CardContent>
        </Card>
      ) : (
        /* Connected state */
        <Card>
          <CardContent className="p-5 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <div className="font-semibold text-foreground">WhatsApp is live</div>
              <div className="text-sm text-muted-foreground mt-1">
                Incoming messages are being received and classified by AI.
              </div>
              {status?.connected_at && (
                <div className="text-xs text-muted-foreground mt-2">
                  Connected {new Date(status.connected_at).toLocaleString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="bg-muted/40 border-dashed">
        <CardContent className="p-4 space-y-2">
          <div className="text-xs font-semibold text-foreground uppercase tracking-wide">How it works</div>
          {[
            "Evolution API acts as a WhatsApp Web bridge (self-hosted).",
            "Scan the QR code with your phone to authenticate the gateway.",
            "Incoming group/contact messages are forwarded via webhook to the societyops service.",
            "GROQ AI classifies each message and creates a ticket automatically.",
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="shrink-0 w-4 h-4 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[10px] font-bold mt-0.5">
                {i + 1}
              </span>
              {s}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Telegram panel ─────────────────────────────────────────────────────────────
function TelegramPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [showToken, setShowToken] = useState(false);

  const { data: status, isLoading: statusLoading } = useGetTelegramStatus({
    query: { refetchInterval: 10000 },
  });

  const { data: qrData, isLoading: qrLoading } = useGetTelegramQr({
    query: { enabled: status?.connected === true },
  });

  const { mutate: setup, isPending: setupPending } = useSetupTelegram({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries();
        toast({
          title: "Telegram bot connected",
          description: `@${data.bot_username} is ready.`,
        });
        setToken("");
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Invalid bot token";
        toast({ title: "Setup failed", description: msg, variant: "destructive" });
      },
    },
  });

  const { mutate: disconnect, isPending: disconnectPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/connect/telegram", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Telegram bot disconnected" });
    },
  });

  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setup({ data: { bot_token: token.trim(), webhook_url: webhookUrl.trim() || undefined } });
  };

  const connected = status?.connected ?? false;

  return (
    <div className="space-y-4">
      {/* Status card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
                <Send className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                  Telegram Bot
                  {statusLoading ? (
                    <Skeleton className="h-4 w-20 inline-block" />
                  ) : (
                    <StatusBadge connected={connected} />
                  )}
                </div>
                {connected ? (
                  <>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      @{status?.bot_username} · {status?.bot_name}
                    </div>
                    {status?.webhook_url && (
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        {status.webhook_url}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Enter your @BotFather token to connect
                  </div>
                )}
              </div>
            </div>
            {connected && (
              <button
                onClick={() => disconnect()}
                disabled={disconnectPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm text-destructive hover:bg-destructive/5 transition-colors"
              >
                {disconnectPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Remove
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {!connected ? (
        /* Bot token setup form */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Configure Bot Token</CardTitle>
            <CardDescription className="text-sm">
              Create a bot via{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline hover:text-blue-600 inline-flex items-center gap-0.5"
              >
                @BotFather <ExternalLink className="w-3 h-3" />
              </a>{" "}
              and paste the token below.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 pb-6">
            <form onSubmit={handleSetup} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Bot Token</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                    className="w-full pl-8 pr-16 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded"
                  >
                    {showToken ? "hide" : "show"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Format: &lt;bot_id&gt;:&lt;hash&gt;</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Webhook URL{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-domain.com/api/telegram/events"
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={setupPending || !token.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {setupPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Connect Bot
              </button>
            </form>
          </CardContent>
        </Card>
      ) : (
        /* Connected: show QR deep-link */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Bot QR Code</CardTitle>
            <CardDescription className="text-sm">
              Users can scan this QR to open the bot and submit complaints directly via Telegram.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 pt-0 pb-6">
            {qrLoading ? (
              <Skeleton className="w-[258px] h-[258px] rounded-xl" />
            ) : qrData?.qr_data_url ? (
              <QrImage src={qrData.qr_data_url} />
            ) : null}

            {qrData?.bot_link && (
              <div className="w-full rounded-lg bg-muted px-3 py-2 flex items-center justify-between gap-2">
                <a
                  href={qrData.bot_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-blue-500 hover:text-blue-600 underline truncate"
                >
                  {qrData.bot_link}
                </a>
                <div className="flex items-center gap-1 shrink-0">
                  <CopyButton value={qrData.bot_link} />
                  <a
                    href={qrData.bot_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="bg-muted/40 border-dashed">
        <CardContent className="p-4 space-y-2">
          <div className="text-xs font-semibold text-foreground uppercase tracking-wide">How it works</div>
          {[
            "Create a bot via @BotFather on Telegram and copy the API token.",
            "Paste the token above — the system registers a webhook automatically.",
            "Users message the bot to submit complaints directly from Telegram.",
            "Messages are classified by AI and appear in the dashboard as tickets.",
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="shrink-0 w-4 h-4 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[10px] font-bold mt-0.5">
                {i + 1}
              </span>
              {s}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export function ConnectPage({ isDark: _isDark }: ConnectPageProps) {
  const [tab, setTab] = useState<"whatsapp" | "telegram">("whatsapp");
  const { data: waStatus } = useGetWhatsappConnectStatus();
  const { data: tgStatus } = useGetTelegramStatus();

  return (
    <div className="bg-background px-6 pt-8 pb-10">
      <div className="max-w-[720px] mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="font-bold text-[28px] leading-none text-foreground">Channel Connections</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Connect your WhatsApp and Telegram channels to start receiving and classifying complaints.
          </p>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${waStatus?.connected ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800" : "bg-muted text-muted-foreground border-border"}`}>
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp — {waStatus?.connected ? "Connected" : waStatus?.state ?? "Checking…"}
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${tgStatus?.connected ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" : "bg-muted text-muted-foreground border-border"}`}>
            <Send className="w-3.5 h-3.5" />
            Telegram — {tgStatus?.connected ? `@${tgStatus.bot_username}` : "Not configured"}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-6">
          {(["whatsapp", "telegram"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "whatsapp" ? (
                <>
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                  {waStatus?.connected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-0.5" />
                  )}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Telegram
                  {tgStatus?.connected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-0.5" />
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {tab === "whatsapp" ? <WhatsAppPanel /> : <TelegramPanel />}
      </div>
    </div>
  );
}
