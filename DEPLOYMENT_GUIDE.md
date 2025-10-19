# Deployment Guide: Code-Based Notebook Generator

## Overview
This guide walks through deploying the new code-based notebook details generator alongside the existing n8n workflow with a safe feature flag rollback mechanism.

---

## Step 1: Set Environment Variables (BEFORE DEPLOYING)

Go to Supabase Dashboard → Project Settings → Edge Functions → Environment Variables

### Add these new variables:

1. **USE_CODE_BASED_GENERATOR**
   - Value: `false` (IMPORTANT: Start with false!)
   - Description: Feature flag to toggle between n8n and code-based generator

2. **OPENAI_API_KEY**
   - Value: `sk-...` (your OpenAI API key)
   - Description: Required for LLM and Whisper transcription

3. **JINA_API_KEY** (Optional)
   - Value: Your Jina.ai API key (if you have one)
   - Description: For web scraping. May work without it for limited usage.

### Verify existing variables are still set:
- `NOTEBOOK_GENERATION_URL` (n8n webhook URL)
- `NOTEBOOK_GENERATION_AUTH` (authentication header)
- `SUPABASE_URL` (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)

Click **Save** after adding variables.

---

## Step 2: Deploy Edge Functions

### Deploy the new function:

```bash
# Deploy generate-notebook-details-v2 (the new code-based generator)
npx supabase functions deploy generate-notebook-details-v2
```

### Redeploy the updated function:

```bash
# Redeploy generate-notebook-content (now with feature flag logic)
npx supabase functions deploy generate-notebook-content
```

---

## Step 3: Test with Feature Flag OFF (Using n8n)

At this point, the system should still be using the n8n workflow since `USE_CODE_BASED_GENERATOR=false`.

1. Test creating a new notebook with a document
2. Verify it generates title, summary, icon, color, and example questions
3. Check the logs to confirm it says: "⚠️  Using OLD n8n webhook (fallback)"
4. Ensure everything works as before

**Expected log output:**
```
🚦 Feature flag USE_CODE_BASED_GENERATOR: false
⚠️  Using OLD n8n webhook (fallback)
📊 Generator used: n8n-webhook
```

---

## Step 4: Test New Function Directly (Bypass Feature Flag)

Test the new function in isolation before enabling the feature flag.

### Using Supabase CLI:

```bash
npx supabase functions invoke generate-notebook-details-v2 \
  --data '{
    "sourceType": "text",
    "content": "This is a test document about artificial intelligence and machine learning."
  }'
```

### Using curl:

```bash
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-notebook-details-v2' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "sourceType": "text",
    "content": "This is a test document about artificial intelligence."
  }'
```

**Expected response:**
```json
{
  "output": {
    "title": "Artificial Intelligence Overview",
    "summary": "A document discussing AI and ML...",
    "notebook_icon": "🤖",
    "background_color": "blue",
    "example_questions": [
      "What is artificial intelligence?",
      "How does machine learning work?",
      ...
    ]
  }
}
```

### Test different source types:

1. **Text content** (shown above)
2. **Website**: Use `"sourceType": "website", "filePath": "example.com/article"`
3. **File**: Upload a test file and use `"sourceType": "file", "filePath": "notebook-id/source-id.pdf"`

---

## Step 5: Enable Feature Flag (Gradual Rollout)

Once you've verified the new function works correctly in isolation:

### Go to Supabase Dashboard → Edge Functions → Environment Variables

1. Find `USE_CODE_BASED_GENERATOR`
2. Change value from `false` to `true`
3. Click **Save**
4. Changes take effect immediately (within ~30 seconds)

---

## Step 6: Monitor Production Traffic

### Watch the logs in real-time:

```bash
# Monitor generate-notebook-content function
npx supabase functions logs generate-notebook-content --tail

# Monitor the new function
npx supabase functions logs generate-notebook-details-v2 --tail
```

### What to look for:

**Success indicators:**
```
✅ Using NEW code-based generator (generate-notebook-details-v2)
📊 Generator used: code-based-v2
Successfully updated notebook with example questions
```

**Error indicators:**
- Any `Error in generate-notebook-details-v2` messages
- Failed notebook generation status
- Missing titles or summaries
- OpenAI API errors

### Test end-to-end in production:

1. Create a new notebook with a document
2. Verify it generates properly
3. Check that logs show: "✅ Using NEW code-based generator"
4. Compare quality with previous n8n-generated notebooks

---

## Step 7: Rollback (If Needed)

### INSTANT ROLLBACK - No code deployment required!

If you encounter issues:

1. Go to Supabase Dashboard → Edge Functions → Environment Variables
2. Find `USE_CODE_BASED_GENERATOR`
3. Change value from `true` to `false`
4. Click **Save**
5. System immediately reverts to n8n (takes effect in ~30 seconds)

### After rollback:

- Check logs to confirm: "⚠️  Using OLD n8n webhook (fallback)"
- Investigate errors in the new function
- Fix issues and redeploy
- Re-enable feature flag when ready

---

## Step 8: Validation Period

Run both systems in parallel for 24-48 hours:

### Metrics to track:

1. **Success Rate**: Compare error rates between systems
2. **Response Time**: Code-based should be faster
3. **Quality**: Compare generated titles, summaries, questions
4. **Cost**: Monitor OpenAI API costs vs n8n costs
5. **User Feedback**: Any quality differences reported?

### Comparison test:

Generate notebooks with identical content using both systems:

1. With flag OFF (n8n): Generate notebook A
2. With flag ON (code): Generate notebook B
3. Compare outputs side-by-side

---

## Step 9: Final Switchover

Once validated and stable:

1. Keep `USE_CODE_BASED_GENERATOR=true`
2. Monitor for another week
3. Consider deprecating n8n workflow after 30 days
4. Update documentation
5. Remove n8n environment variables (optional)

---

## Troubleshooting

### Issue: OpenAI API errors

**Solution:**
- Verify `OPENAI_API_KEY` is set correctly
- Check OpenAI account has credits
- Check API usage limits

### Issue: File extraction fails

**Solution:**
- Verify Supabase storage permissions
- Check signed URL generation works
- Test with smaller files first

### Issue: Website scraping fails

**Solution:**
- Verify Jina.ai is accessible
- Try with/without API key
- Check website is publicly accessible

### Issue: Function timeout

**Solution:**
- Large files may timeout
- Consider implementing background processing
- Add timeout handling

---

## Performance Comparison

### Expected improvements with code-based approach:

- **Speed**: 30-50% faster (no n8n overhead)
- **Cost**: Lower (direct API calls, no n8n hosting)
- **Reliability**: Better error handling and retries
- **Debugging**: Full control over logs and error messages
- **Maintenance**: Easier to update and extend

---

## Next Steps

After successful deployment:

1. Monitor for 1 week with feature flag enabled
2. Gather user feedback
3. Compare cost metrics
4. Document any issues found
5. Consider migrating other n8n workflows using same pattern

---

## Support

If you encounter issues:

1. Check function logs first
2. Verify environment variables are set
3. Test function in isolation
4. Use feature flag to rollback if needed
5. Review error messages in Supabase dashboard

Remember: The feature flag gives you instant rollback capability. Don't hesitate to toggle back to n8n if something doesn't work right!
