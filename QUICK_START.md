# Quick Start Guide: Deploy Code-Based Notebook Generator

## 🚀 Ready to Deploy? Follow These Steps

### Step 1: Set Environment Variables (5 minutes)

1. Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Environment Variables**

2. Add these variables:

```
USE_CODE_BASED_GENERATOR = false
OPENAI_API_KEY = sk-your-openai-api-key-here
```

3. Click **Save**

---

### Step 2: Deploy Functions (2 minutes)

Run these commands in your terminal:

```bash
# Deploy the new code-based generator
npx supabase functions deploy generate-notebook-details-v2

# Redeploy the router with feature flag logic
npx supabase functions deploy generate-notebook-content
```

---

### Step 3: Test (Still Using N8N) (5 minutes)

The system should still be using n8n since the flag is `false`.

1. Open your app
2. Create a test notebook
3. Verify it works as before
4. Check Supabase logs - should see: "⚠️  Using OLD n8n webhook (fallback)"

✅ **If this works, you're safe to continue!**

---

### Step 4: Test New Function Directly (5 minutes)

Test the new function without switching production:

```bash
npx supabase functions invoke generate-notebook-details-v2 \
  --data '{
    "sourceType": "text",
    "content": "Machine learning is a subset of artificial intelligence that focuses on building systems that can learn from data."
  }'
```

**Expected output:**
```json
{
  "output": {
    "title": "Machine Learning Overview",
    "summary": "A brief introduction to machine learning...",
    "notebook_icon": "🤖",
    "background_color": "blue",
    "example_questions": ["What is machine learning?", ...]
  }
}
```

✅ **If this works, you're ready to switch!**

---

### Step 5: Enable Feature Flag (1 minute)

1. Go back to **Supabase Dashboard** → **Edge Functions** → **Environment Variables**
2. Change `USE_CODE_BASED_GENERATOR` from `false` to `true`
3. Click **Save**
4. Wait 30 seconds for changes to propagate

---

### Step 6: Test in Production (10 minutes)

1. Create a new notebook in your app
2. Verify it generates properly
3. Check the logs - should see: "✅ Using NEW code-based generator"
4. Compare quality with previous notebooks

✅ **If quality is good, you're done!**

---

### Step 7: Monitor (24 hours)

Keep an eye on:
- Error logs in Supabase dashboard
- User feedback
- Notebook quality
- System performance

---

## 🔄 Need to Rollback?

If something goes wrong:

1. Go to **Supabase Dashboard** → **Edge Functions** → **Environment Variables**
2. Change `USE_CODE_BASED_GENERATOR` from `true` to `false`
3. Click **Save**
4. System reverts to n8n in ~30 seconds

**No code deployment needed for rollback!**

---

## 📚 Full Documentation

For detailed instructions, see:

- **`DEPLOYMENT_GUIDE.md`** - Complete deployment process
- **`TESTING_CHECKLIST.md`** - Comprehensive testing checklist
- **`ENVIRONMENT_VARIABLES.md`** - All environment variable details
- **`IMPLEMENTATION_SUMMARY.md`** - Technical overview

---

## ⚠️ Important Notes

- Always start with `USE_CODE_BASED_GENERATOR=false` (safe mode)
- Test n8n still works before enabling new system
- Test new function in isolation before production
- Monitor logs closely after switching
- Feature flag allows instant rollback

---

## 🆘 Troubleshooting

### Issue: Function deployment fails
**Solution:** Check you're in the project directory and logged into Supabase CLI

### Issue: OpenAI errors
**Solution:** Verify `OPENAI_API_KEY` is set correctly and has credits

### Issue: Quality seems worse
**Solution:** Rollback immediately and review logs

### Issue: System using wrong generator
**Solution:** Wait 30 seconds after changing flag, check logs confirm switch

---

## 📞 Support

If you encounter issues:
1. Check function logs in Supabase dashboard
2. Review error messages
3. Try rollback to n8n
4. Consult full documentation

---

**Total Time:** ~30 minutes from start to production deployment

**Risk Level:** ⭐ Very Low (instant rollback available)

**Difficulty:** 🟢 Easy (if you follow the steps)

Good luck! 🚀
