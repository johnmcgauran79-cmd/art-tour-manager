import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AU_STATES } from "@/lib/edm/audience";
import { parseFormFields } from "@/lib/marketing/formFields";


interface PublicTour {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
}

interface PublicPage {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  subheadline: string | null;
  body_html: string | null;
  hero_image_url: string | null;
  consent_text: string | null;
  thank_you_message: string | null;
  thank_you_heading: string | null;
  submit_button_text: string | null;
  fields: unknown;
  form_type: "interest" | "booking";
  success_redirect_url: string | null;
  show_country: boolean | null;
  show_travellers: boolean | null;
  show_previous_traveller: boolean | null;
  show_preferred_contact: boolean | null;
  allow_multiple_tours: boolean | null;
  brand?: {
    name: string;
    logo_url: string | null;
    color_primary: string | null;
    color_button: string | null;
    color_button_text: string | null;
    company_website: string | null;
    company_phone: string | null;
  } | null;
}


interface PaxRow {
  first_name: string;
  last_name: string;
  dietary: string;
}

const ROOM_TYPES = ["Single", "Twin share", "Double", "Triple"];
const CONTACT_METHODS = ["Email", "Phone call", "Text message"];

/**
 * Public register-interest / booking form. No login required — reads the page
 * definition and posts submissions through edge functions.
 */
export default function PublicForm() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const embedded = searchParams.get("embed") === "1";
  /** Stable reference so a retried or double-tapped submit is only stored once. */
  const submissionUid = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const [page, setPage] = useState<PublicPage | null>(null);
  const [tours, setTours] = useState<PublicTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    state: "",
    message: "",
    consent: false,
    honeypot: "",
    country: "",
    travellers: "",
    previous_traveller: "",
    preferred_contact: "",
    room_type: "",
    bedding: "",
    emergency_contact: "",
    special_requests: "",
  });
  const [selectedTours, setSelectedTours] = useState<string[]>([]);
  const [pax, setPax] = useState<PaxRow[]>([{ first_name: "", last_name: "", dietary: "" }]);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});


  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("marketing-landing-page", {
        body: { slug },
      });
      if (error || (data as any)?.error) {
        setLoadError("This form is not available.");
      } else {
        setPage((data as any).page);
        setTours((data as any).tours || []);
      }
      setLoading(false);
    })();
  }, [slug]);

  /* Marketing attribution captured from the page URL, so Google Ads / EDM
     traffic can be told apart later. */
  const attribution = useMemo(
    () => ({
      utm_source: searchParams.get("utm_source") || "",
      utm_medium: searchParams.get("utm_medium") || "",
      utm_campaign: searchParams.get("utm_campaign") || "",
      utm_content: searchParams.get("utm_content") || "",
      utm_term: searchParams.get("utm_term") || "",
      referrer: searchParams.get("ref") || document.referrer || "",
      landing_page_url: window.location.href,
    }),
    [searchParams]
  );

  /* When embedded in an iframe, tell the parent page how tall we are so the
     form never scrolls inside a small box. */
  useEffect(() => {
    if (!embedded) return;
    const send = () =>
      window.parent?.postMessage(
        { type: "art-form-height", slug, height: document.body.scrollHeight },
        "*"
      );
    send();
    const observer = new ResizeObserver(send);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [embedded, slug, page, done]);

  const isBooking = page?.form_type === "booking";
  const accent = page?.brand?.color_button || page?.brand?.color_primary || undefined;

  const heading = useMemo(() => page?.headline || page?.title || "", [page]);
  const customFields = useMemo(() => parseFormFields(page?.fields), [page]);

  const toggleTour = (id: string) =>
    setSelectedTours((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : isBooking ? [id] : [...prev, id]
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.first_name.trim() || !form.email.trim()) {
      setError("Please enter your name and email address.");
      return;
    }
    if (isBooking && selectedTours.length === 0) {
      setError("Please choose the tour you'd like to book.");
      return;
    }
    const missing = customFields.find(
      (f) =>
        f.required &&
        f.type !== "heading" &&
        (f.type === "checkbox" ? answers[f.key] !== true : !String(answers[f.key] ?? "").trim())
    );
    if (missing) {
      setError(`Please complete "${missing.label}".`);
      return;
    }
    setSubmitting(true);
    const { data, error: fnError } = await supabase.functions.invoke("marketing-submit-lead", {
      body: {
        slug,
        submission_uid: submissionUid.current,
        attribution,
        country: form.country,
        travellers: form.travellers ? Number(form.travellers) : null,
        previous_traveller:
          form.previous_traveller === "" ? null : form.previous_traveller === "yes",
        preferred_contact: form.preferred_contact,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        state: form.state,
        message: form.message,
        consent: form.consent,
        company_website_hp: form.honeypot,
        tour_ids: selectedTours,
        extra: {
          ...(isBooking
            ? {
                passengers: pax.filter((p) => p.first_name || p.last_name),
                room_type: form.room_type,
                bedding: form.bedding,
                emergency_contact: form.emergency_contact,
                special_requests: form.special_requests,
              }
            : {}),
          answers: customFields
            .filter((f) => f.type !== "heading")
            .map((f) => ({
              label: f.label,
              value:
                f.type === "checkbox"
                  ? answers[f.key] === true
                    ? "Yes"
                    : "No"
                  : String(answers[f.key] ?? ""),
            })),
        },
      },
    });

    setSubmitting(false);
    if (fnError || (data as any)?.error) {
      setError((data as any)?.error || "Something went wrong — please try again.");
      return;
    }
    setDone((data as any)?.thank_you || page?.thank_you_message || "Thanks — we'll be in touch.");
    const redirect = (data as any)?.redirect_url || page?.success_redirect_url;
    if (redirect) {
      if (embedded) window.parent?.postMessage({ type: "art-form-redirect", url: redirect }, "*");
      window.setTimeout(() => {
        (embedded ? window.parent || window : window).location.href = redirect;
      }, 1200);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !page) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {loadError || "Form not found."}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={embedded ? "bg-transparent py-2" : "min-h-screen bg-muted/40 py-8"}>
      <div className={embedded ? "mx-auto w-full max-w-2xl px-2" : "mx-auto w-full max-w-2xl px-4"}>
        {!embedded && page.brand?.logo_url && (
          <img
            src={page.brand.logo_url}
            alt={page.brand.name}
            className="mx-auto mb-6 h-16 w-auto object-contain"
          />
        )}

        <Card className={embedded ? "border-0 shadow-none" : undefined}>
          {!embedded && page.hero_image_url && (
            <img
              src={page.hero_image_url}
              alt={page.title}
              className="h-52 w-full rounded-t-lg object-cover"
              loading="lazy"
            />
          )}
          <CardHeader>
            <CardTitle className="text-2xl" style={accent ? { color: accent } : undefined}>
              {heading}
            </CardTitle>
            {page.subheadline && (
              <p className="text-sm text-muted-foreground">{page.subheadline}</p>
            )}
          </CardHeader>

          <CardContent>
            {done ? (
              <div className="space-y-3 py-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
                {page.thank_you_heading && (
                  <h2 className="text-xl font-semibold">{page.thank_you_heading}</h2>
                )}
                <p className="text-base font-medium">{done}</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                {page.body_html && (
                  <div
                    className="prose prose-sm max-w-none text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: page.body_html }}
                  />
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name">First name *</Label>
                    <Input
                      id="first_name"
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name">Surname</Label>
                    <Input
                      id="last_name"
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="state">State</Label>
                    <Select
                      value={form.state}
                      onValueChange={(state) => setForm({ ...form, state })}
                    >
                      <SelectTrigger id="state">
                        <SelectValue placeholder="Select your state" />
                      </SelectTrigger>
                      <SelectContent>
                        {AU_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                        <SelectItem value="Overseas">Overseas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {page.show_country && (
                    <div className="space-y-1.5">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={form.country}
                        onChange={(e) => setForm({ ...form, country: e.target.value })}
                      />
                    </div>
                  )}
                  {page.show_travellers !== false && (
                    <div className="space-y-1.5">
                      <Label htmlFor="travellers">How many travelling?</Label>
                      <Input
                        id="travellers"
                        type="number"
                        min={1}
                        max={99}
                        inputMode="numeric"
                        value={form.travellers}
                        onChange={(e) => setForm({ ...form, travellers: e.target.value })}
                      />
                    </div>
                  )}
                  {page.show_previous_traveller !== false && (
                    <div className="space-y-1.5">
                      <Label htmlFor="previous_traveller">Travelled with us before?</Label>
                      <Select
                        value={form.previous_traveller}
                        onValueChange={(previous_traveller) =>
                          setForm({ ...form, previous_traveller })
                        }
                      >
                        <SelectTrigger id="previous_traveller">
                          <SelectValue placeholder="Please choose" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {page.show_preferred_contact && (
                    <div className="space-y-1.5">
                      <Label htmlFor="preferred_contact">Preferred contact method</Label>
                      <Select
                        value={form.preferred_contact}
                        onValueChange={(preferred_contact) =>
                          setForm({ ...form, preferred_contact })
                        }
                      >
                        <SelectTrigger id="preferred_contact">
                          <SelectValue placeholder="Please choose" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTACT_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {tours.length > 0 && (
                  <div className="space-y-2">
                    <Label>
                      {isBooking ? "Which tour would you like to book? *" : "Tours you're interested in"}
                    </Label>
                    <div className="space-y-2 rounded-md border p-3">
                      {tours.map((t) => (
                        <label key={t.id} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={selectedTours.includes(t.id)}
                            onCheckedChange={() => toggleTour(t.id)}
                          />
                          <span>
                            {t.name}
                            {t.start_date && (
                              <span className="block text-xs text-muted-foreground">
                                From {format(new Date(t.start_date), "dd/MM/yyyy")}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {isBooking && (
                  <>
                    <div className="space-y-2">
                      <Label>Passengers</Label>
                      {pax.map((p, i) => (
                        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                          <Input
                            placeholder="First name"
                            value={p.first_name}
                            onChange={(e) =>
                              setPax(pax.map((x, j) => (j === i ? { ...x, first_name: e.target.value } : x)))
                            }
                          />
                          <Input
                            placeholder="Surname"
                            value={p.last_name}
                            onChange={(e) =>
                              setPax(pax.map((x, j) => (j === i ? { ...x, last_name: e.target.value } : x)))
                            }
                          />
                          <Input
                            placeholder="Dietary needs"
                            value={p.dietary}
                            onChange={(e) =>
                              setPax(pax.map((x, j) => (j === i ? { ...x, dietary: e.target.value } : x)))
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Remove passenger"
                            onClick={() => setPax(pax.filter((_, j) => j !== i))}
                            disabled={pax.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setPax([...pax, { first_name: "", last_name: "", dietary: "" }])}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add passenger
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Room type</Label>
                        <Select
                          value={form.room_type}
                          onValueChange={(room_type) => setForm({ ...form, room_type })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select room type" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROOM_TYPES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bedding preference</Label>
                        <Select
                          value={form.bedding}
                          onValueChange={(bedding) => setForm({ ...form, bedding })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select bedding" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Single beds">Single beds</SelectItem>
                            <SelectItem value="Double bed">Double bed</SelectItem>
                            <SelectItem value="King bed">King bed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Emergency contact (name and phone)</Label>
                        <Input
                          value={form.emergency_contact}
                          onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Special requests</Label>
                        <Textarea
                          rows={3}
                          value={form.special_requests}
                          onChange={(e) => setForm({ ...form, special_requests: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {customFields.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {customFields.map((f) => {
                      const span = f.width === "half" ? "" : "sm:col-span-2";
                      if (f.type === "heading") {
                        return (
                          <h3 key={f.key} className="sm:col-span-2 pt-2 text-base font-semibold">
                            {f.label}
                          </h3>
                        );
                      }
                      const value = String(answers[f.key] ?? "");
                      const set = (v: string | boolean) =>
                        setAnswers((prev) => ({ ...prev, [f.key]: v }));
                      return (
                        <div key={f.key} className={`space-y-1.5 ${span}`}>
                          {f.type !== "checkbox" && (
                            <Label htmlFor={`cf-${f.key}`}>
                              {f.label}
                              {f.required ? " *" : ""}
                            </Label>
                          )}
                          {f.type === "textarea" ? (
                            <Textarea
                              id={`cf-${f.key}`}
                              rows={3}
                              placeholder={f.placeholder || ""}
                              value={value}
                              onChange={(e) => set(e.target.value)}
                            />
                          ) : f.type === "select" ? (
                            <Select value={value} onValueChange={set}>
                              <SelectTrigger id={`cf-${f.key}`}>
                                <SelectValue placeholder={f.placeholder || "Please choose"} />
                              </SelectTrigger>
                              <SelectContent>
                                {(f.options || []).map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : f.type === "radio" ? (
                            <div className="space-y-1.5">
                              {(f.options || []).map((o) => (
                                <label key={o} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="radio"
                                    name={`cf-${f.key}`}
                                    checked={value === o}
                                    onChange={() => set(o)}
                                  />
                                  <span>{o}</span>
                                </label>
                              ))}
                            </div>
                          ) : f.type === "checkbox" ? (
                            <label className="flex items-start gap-2 text-sm">
                              <Checkbox
                                checked={answers[f.key] === true}
                                onCheckedChange={(v) => set(!!v)}
                              />
                              <span>
                                {f.label}
                                {f.required ? " *" : ""}
                              </span>
                            </label>
                          ) : (
                            <Input
                              id={`cf-${f.key}`}
                              type={
                                f.type === "email"
                                  ? "email"
                                  : f.type === "number"
                                    ? "number"
                                    : f.type === "date"
                                      ? "date"
                                      : f.type === "phone"
                                        ? "tel"
                                        : "text"
                              }
                              placeholder={f.placeholder || ""}
                              value={value}
                              onChange={(e) => set(e.target.value)}
                            />
                          )}
                          {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="message">
                    {isBooking ? "Anything else we should know?" : "Your message"}
                  </Label>
                  <Textarea
                    id="message"
                    rows={3}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                  />
                </div>


                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={form.consent}
                    onCheckedChange={(v) => setForm({ ...form, consent: !!v })}
                  />
                  <span className="text-muted-foreground">
                    {page.consent_text ||
                      "Yes, I'd like to receive tour news and offers. You can unsubscribe at any time."}
                  </span>
                </label>

                {/* Honeypot — hidden from real visitors */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                  value={form.honeypot}
                  onChange={(e) => setForm({ ...form, honeypot: e.target.value })}
                />

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitting}
                  style={
                    accent
                      ? { backgroundColor: accent, color: page.brand?.color_button_text || "#fff" }
                      : undefined
                  }
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {page.submit_button_text ||
                    (isBooking ? "Submit booking request" : "Register my interest")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className={embedded ? "hidden" : "mt-6 text-center text-xs text-muted-foreground"}>
          {page.brand?.name || "Australian Racing Tours"}
          {page.brand?.company_phone ? ` · ${page.brand.company_phone}` : ""}
        </p>
      </div>
    </div>
  );
}
