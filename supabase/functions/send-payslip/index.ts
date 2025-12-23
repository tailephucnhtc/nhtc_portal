import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend("re_b1mBtQNF_JKL9eEQH3WEHFp3E6uLYvep5");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { email, subject, html, fromEmail } = await req.json();

        const sender = fromEmail || "NHTC Payroll <onboarding@resend.dev>";

        const { data, error } = await resend.emails.send({
            from: sender,
            to: [email],
            subject: subject,
            html: html,
        });

        if (error) {
            console.error("Resend API Error:", error);
            return new Response(JSON.stringify({ error }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (err) {
        console.error("Unexpected Error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
