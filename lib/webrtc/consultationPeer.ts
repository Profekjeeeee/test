import type { RealtimeChannel } from "@supabase/supabase-js";

import { removeSupabaseChannel, uniqueRealtimeChannelName } from "@/lib/supabaseRealtime";
import { supabase } from "@/lib/supabaseClient";

export type SignalingRole = "doctor" | "patient";

export type SignalingMessage =
  | { type: "offer"; sdp: RTCSessionDescriptionInit; from: SignalingRole }
  | { type: "answer"; sdp: RTCSessionDescriptionInit; from: SignalingRole }
  | { type: "ice"; candidate: RTCIceCandidateInit; from: SignalingRole }
  | { type: "hangup"; from: SignalingRole };

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export interface ConsultationPeerOptions {
  consultationId: string;
  role: SignalingRole;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionState?: (state: RTCPeerConnectionState) => void;
  onError?: (message: string) => void;
}

export class ConsultationPeer {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private channel: RealtimeChannel | null = null;
  private readonly opts: ConsultationPeerOptions;
  private disposed = false;

  constructor(opts: ConsultationPeerOptions) {
    this.opts = opts;
  }

  async start(): Promise<MediaStream> {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Камера и микрофон недоступны в этом окружении.");
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true,
    });

    this.pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    for (const track of this.localStream.getTracks()) {
      this.pc.addTrack(track, this.localStream);
    }

    this.pc.ontrack = (ev) => {
      if (ev.streams[0]) this.opts.onRemoteStream(ev.streams[0]);
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc) this.opts.onConnectionState?.(this.pc.connectionState);
    };

    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        void this.broadcast({ type: "ice", candidate: ev.candidate.toJSON(), from: this.opts.role });
      }
    };

    await this.subscribeSignaling();

    if (this.opts.role === "doctor") {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      await this.broadcast({ type: "offer", sdp: offer, from: this.opts.role });
    }

    return this.localStream;
  }

  private async subscribeSignaling(): Promise<void> {
    const channelName = uniqueRealtimeChannelName(`consultation:${this.opts.consultationId}`);
    this.channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    this.channel.on("broadcast", { event: "signal" }, ({ payload }) => {
      void this.handleSignal(payload as SignalingMessage);
    });

    await new Promise<void>((resolve, reject) => {
      this.channel!.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(new Error("Не удалось подключиться к каналу сигнализации."));
        }
      });
    });
  }

  private async broadcast(msg: SignalingMessage): Promise<void> {
    if (!this.channel || this.disposed) return;
    await this.channel.send({ type: "broadcast", event: "signal", payload: msg });
  }

  private async handleSignal(msg: SignalingMessage): Promise<void> {
    if (this.disposed || !this.pc || msg.from === this.opts.role) return;

    try {
      if (msg.type === "offer") {
        await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        await this.broadcast({ type: "answer", sdp: answer, from: this.opts.role });
      } else if (msg.type === "answer") {
        await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      } else if (msg.type === "ice") {
        if (msg.candidate) {
          await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        }
      } else if (msg.type === "hangup") {
        this.opts.onConnectionState?.("disconnected");
      }
    } catch (e) {
      this.opts.onError?.(e instanceof Error ? e.message : "Ошибка WebRTC");
    }
  }

  toggleAudio(enabled: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }

  toggleVideo(enabled: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }

  async hangup(): Promise<void> {
    await this.broadcast({ type: "hangup", from: this.opts.role });
    this.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.pc?.close();
    this.pc = null;
    if (this.channel) {
      removeSupabaseChannel(this.channel);
      this.channel = null;
    }
  }
}
