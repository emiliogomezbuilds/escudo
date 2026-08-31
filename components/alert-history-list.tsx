import { Badge } from "@/components/ui/badge";

type AlertCall = {
  id: string;
  script_text: string;
  call_status: string;
  placed_at: string;
};

type RiskEvent = {
  id: string;
  amount: number;
  payee_label: string;
  matched: boolean;
  is_simulated: boolean;
  created_at: string;
  alert_calls: AlertCall[];
};

function formatMXN(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function CallStatusBadge({ status }: { status: string }) {
  if (status === "initiated") {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-800">
        Llamada real iniciada
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600">
        Llamada fallida
      </Badge>
    );
  }
  return <Badge variant="outline">Pendiente</Badge>;
}

export function AlertHistoryList({ events }: { events: RiskEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay eventos registrados.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map((event) => {
        const call = event.alert_calls?.[0];
        return (
          <li
            key={event.id}
            className="flex flex-col gap-2 rounded-md border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {formatMXN(event.amount)} → {event.payee_label}
                </span>
                {event.matched ? (
                  <Badge variant="destructive">Coincidencia</Badge>
                ) : (
                  <Badge variant="outline">Sin coincidencia</Badge>
                )}
                {event.is_simulated && (
                  <Badge variant="outline" className="text-[10px]">
                    SIMULADO
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(event.created_at)}
              </span>
            </div>

            {call && (
              <div className="flex flex-col gap-1 border-t pt-2">
                <CallStatusBadge status={call.call_status} />
                <p className="text-sm italic text-muted-foreground">
                  &ldquo;{call.script_text}&rdquo;
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
