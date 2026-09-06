"use client";

import { useTripStore } from "@/store/trip-store";
import { CheckCircle2, AlertCircle, Clock, Activity } from "lucide-react";

const AGENT_ORDER = [
  "orchestrator","user_preference","destination","transport",
  "hotel","activity","itinerary","budget","verification","replanning",
];

function Dot({ status }: { status: string }) {
  if (status === "running") return (
    <span style={{ width:"6px",height:"6px",borderRadius:"50%",background:"var(--color-primary-500)",boxShadow:"0 0 5px rgba(139, 92, 246, 0.7)",animation:"dot-pulse 2.5s infinite ease-in-out",flexShrink:0,display:"inline-block" }} />
  );
  if (status === "completed") return <CheckCircle2 style={{width:"0.75rem",height:"0.75rem",flexShrink:0,color:"var(--color-success)"}} />;
  if (status === "failed") return <AlertCircle style={{width:"0.75rem",height:"0.75rem",flexShrink:0,color:"var(--color-error)"}} />;
  return <Clock style={{width:"0.75rem",height:"0.75rem",flexShrink:0,color:"var(--color-text-muted)"}} />;
}

export function AgentActivityPanel({ compact }: { compact?: boolean }) {
  const { agentActivities, recentEvents } = useTripStore();
  const active = AGENT_ORDER.filter(k => agentActivities[k]);
  const running = active.filter(k => agentActivities[k]?.status === "running").length;
  const done = active.filter(k => agentActivities[k]?.status === "completed").length;

  if (compact) {
    return (
      <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.25rem"}}>
          <span style={{fontSize:"0.625rem",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--color-text-muted)"}}>Agents</span>
          <span style={{fontSize:"0.625rem",color:"var(--color-text-muted)"}}>{done}/{active.length}</span>
        </div>
        {AGENT_ORDER.map(k => {
          const a = agentActivities[k];
          if (!a) return null;
          const isRunning = a.status === "running";
          return (
            <div key={k} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.3125rem 0.375rem",borderRadius:"0.3125rem",background:isRunning?"rgba(139, 92, 246, 0.08)":"transparent"}}>
              <Dot status={a.status} />
              <span style={{fontSize:"0.6875rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:a.status==="completed"?"var(--color-text-muted)":"var(--color-text-secondary)",flex:1}}>{a.name}</span>
              {a.itemsFound !== undefined && <span style={{fontSize:"0.625rem",color:"var(--color-success)",fontVariantNumeric:"tabular-nums",flexShrink:0}}>+{a.itemsFound}</span>}
            </div>
          );
        })}
        {running > 0 && <p style={{fontSize:"0.625rem",color:"var(--color-primary-500)",marginTop:"0.25rem"}}>{running} agent{running>1?"s":""} working...</p>}
      </div>
    );
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
        <div style={{background:"var(--color-bg-card)",border:"1px solid var(--color-border)",borderRadius:"0.625rem",padding:"0.625rem 0.75rem"}}>
          <p style={{fontSize:"1rem",fontWeight:700,lineHeight:1,color:"var(--color-text-primary)"}}>{done}</p>
          <p style={{fontSize:"0.6875rem",color:"var(--color-text-muted)",marginTop:"0.25rem"}}>Completed</p>
        </div>
        <div style={{background:running>0?"rgba(139, 92, 246, 0.08)":"var(--color-bg-card)",border:`1px solid ${running>0?"rgba(139, 92, 246, 0.2)":"var(--color-border)"}`,borderRadius:"0.625rem",padding:"0.625rem 0.75rem"}}>
          <p style={{fontSize:"1rem",fontWeight:700,lineHeight:1,color:running>0?"var(--color-primary-500)":"var(--color-text-primary)"}}>{running}</p>
          <p style={{fontSize:"0.6875rem",color:"var(--color-text-muted)",marginTop:"0.25rem"}}>Running</p>
        </div>
      </div>

      <div style={{background:"var(--color-bg-card)",border:"1px solid var(--color-border)",borderRadius:"0.75rem",overflow:"hidden"}}>
        <div style={{padding:"0.5rem 0.875rem",borderBottom:"1px solid var(--color-border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:"0.625rem",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--color-text-muted)"}}>Agent network</span>
          <span style={{fontSize:"0.625rem",color:"var(--color-text-muted)"}}>{active.length}/{AGENT_ORDER.length}</span>
        </div>
        <div style={{padding:"0.375rem"}}>
          {AGENT_ORDER.map(k => {
            const a = agentActivities[k];
            if (!a) return null;
            const isRunning = a.status === "running";
            const isDone = a.status === "completed";
            return (
              <div key={k} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.4375rem 0.5rem",borderRadius:"0.375rem",background:isRunning?"rgba(167, 122, 43, 0.08)":"transparent",border:isRunning?"1px solid rgba(167, 122, 43, 0.15)":"1px solid transparent",marginBottom:"0.125rem"}}>
                <Dot status={a.status} />
                <div style={{minWidth:0,flex:1}}>
                  <p style={{fontSize:"0.75rem",fontWeight:500,lineHeight:1.3,color:isDone?"var(--color-text-secondary)":"var(--color-text-primary)"}}>{a.name}</p>
                  {a.status!=="waiting" && <p style={{fontSize:"0.625rem",color:"var(--color-text-muted)",marginTop:"0.125rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.message}</p>}
                </div>
                {a.itemsFound!==undefined && <span style={{fontSize:"0.625rem",fontWeight:600,color:"var(--color-success)",flexShrink:0,fontVariantNumeric:"tabular-nums"}}>+{a.itemsFound}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {recentEvents.length > 0 && (
        <div style={{background:"var(--color-bg-card)",border:"1px solid var(--color-border)",borderRadius:"0.75rem",overflow:"hidden"}}>
          <div style={{padding:"0.4375rem 0.875rem",borderBottom:"1px solid var(--color-border)",display:"flex",alignItems:"center",gap:"0.375rem"}}>
            <Activity style={{width:"0.75rem",height:"0.75rem",color:"var(--color-primary-500)"}} />
            <span style={{fontSize:"0.625rem",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--color-text-muted)"}}>Live log</span>
          </div>
          <div style={{padding:"0.5rem 0.875rem",maxHeight:"120px",overflowY:"auto"}}>
            {recentEvents.slice(0,8).map((ev, index) => (
              <div key={`${ev.event_id || "event"}-${ev.timestamp}-${index}`} style={{display:"flex",alignItems:"baseline",gap:"0.5rem",marginBottom:"0.3125rem"}}>
                <span style={{fontSize:"0.5625rem",fontFamily:"monospace",color:"var(--color-text-muted)",flexShrink:0}}>
                  {new Date(ev.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
                </span>
                <span style={{fontSize:"0.625rem",color:"var(--color-text-secondary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}