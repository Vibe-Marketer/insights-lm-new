# Testing Checklist: Code-Based Notebook Generator

## Pre-Deployment Tests ✓

### Environment Setup
- [ ] All environment variables documented in `ENVIRONMENT_VARIABLES.md`
- [ ] `USE_CODE_BASED_GENERATOR` set to `false` initially
- [ ] `OPENAI_API_KEY` obtained and ready to add
- [ ] N8N webhook URLs verified and working

---

## Phase 1: Deploy with Feature Flag OFF (Safe Mode)

### Deployment
- [ ] Deploy `generate-notebook-details-v2` function
- [ ] Redeploy `generate-notebook-content` function with feature flag logic
- [ ] Verify both functions deployed successfully
- [ ] Check no deployment errors in Supabase dashboard

### Baseline Testing (Should use n8n)
- [ ] Create notebook with text content
- [ ] Create notebook with website URL
- [ ] Create notebook with uploaded file
- [ ] Verify all generate properly (using n8n)
- [ ] Check logs show: "⚠️  Using OLD n8n webhook (fallback)"
- [ ] Confirm `generatorUsed: "n8n-webhook"` in response

**Result:** System should work exactly as before. No changes to user experience.

---

## Phase 2: Test New Function in Isolation

### Direct Function Tests

#### Test 1: Text Content
```bash
npx supabase functions invoke generate-notebook-details-v2 \
  --data '{
    "sourceType": "text",
    "content": "Machine learning is a subset of artificial intelligence..."
  }'
```

**Expected:**
- [ ] Returns valid JSON with `output` object
- [ ] Contains `title`, `summary`, `notebook_icon`, `background_color`, `example_questions`
- [ ] Title is relevant to content
- [ ] 5 example questions generated
- [ ] No errors in logs

#### Test 2: Website URL
```bash
npx supabase functions invoke generate-notebook-details-v2 \
  --data '{
    "sourceType": "website",
    "filePath": "wikipedia.org/wiki/Artificial_intelligence"
  }'
```

**Expected:**
- [ ] Successfully fetches webpage with Jina.ai
- [ ] Extracts text content
- [ ] Generates appropriate metadata
- [ ] No timeout errors

#### Test 3: PDF File
**Setup:** Upload a test PDF to Supabase storage first

```bash
npx supabase functions invoke generate-notebook-details-v2 \
  --data '{
    "sourceType": "file",
    "filePath": "test-notebook-id/test-source-id.pdf"
  }'
```

**Expected:**
- [ ] Downloads file from storage
- [ ] Extracts text from PDF
- [ ] Generates metadata
- [ ] No file access errors

#### Test 4: Audio File (if applicable)
**Setup:** Upload a test audio file to Supabase storage

```bash
npx supabase functions invoke generate-notebook-details-v2 \
  --data '{
    "sourceType": "audio",
    "filePath": "test-notebook-id/test-audio.mp3"
  }'
```

**Expected:**
- [ ] Downloads audio file
- [ ] Transcribes with Whisper
- [ ] Generates metadata from transcript
- [ ] No transcription errors

### Error Handling Tests

#### Test 5: Missing Required Fields
```bash
npx supabase functions invoke generate-notebook-details-v2 \
  --data '{}'
```

**Expected:**
- [ ] Returns 400 error
- [ ] Error message: "sourceType is required"

#### Test 6: Invalid Source Type
```bash
npx supabase functions invoke generate-notebook-details-v2 \
  --data '{
    "sourceType": "invalid",
    "content": "test"
  }'
```

**Expected:**
- [ ] Handles gracefully
- [ ] Returns appropriate error

#### Test 7: Empty Content
```bash
npx supabase functions invoke generate-notebook-details-v2 \
  --data '{
    "sourceType": "text",
    "content": ""
  }'
```

**Expected:**
- [ ] Returns error about empty content
- [ ] No crash

---

## Phase 3: Enable Feature Flag

### Pre-Switch Verification
- [ ] All Phase 2 tests passed
- [ ] No errors in function logs
- [ ] OpenAI API key working
- [ ] Ready to monitor logs

### Enable Feature Flag
- [ ] Go to Supabase Dashboard
- [ ] Navigate to Edge Functions → Environment Variables
- [ ] Change `USE_CODE_BASED_GENERATOR` from `false` to `true`
- [ ] Save changes
- [ ] Wait 30 seconds for propagation

### Post-Switch Verification
- [ ] Check logs show: "✅ Using NEW code-based generator"
- [ ] Response includes `generatorUsed: "code-based-v2"`

---

## Phase 4: End-to-End Production Tests

### Test Each Source Type in Production

#### E2E Test 1: Text Content
- [ ] Go to app, create new notebook
- [ ] Use "Paste Text" option
- [ ] Paste sample text
- [ ] Click create
- [ ] Verify notebook generated successfully
- [ ] Check title, summary, icon, color are appropriate
- [ ] Verify 5 example questions generated
- [ ] Questions are relevant to content

#### E2E Test 2: Website URL
- [ ] Create new notebook
- [ ] Use "Add Website" option
- [ ] Enter: `https://en.wikipedia.org/wiki/Machine_learning`
- [ ] Click create
- [ ] Verify fetches and processes
- [ ] Check all metadata generated

#### E2E Test 3: File Upload
- [ ] Create new notebook
- [ ] Upload a PDF file
- [ ] Verify file uploads
- [ ] Verify text extraction works
- [ ] Check metadata generated correctly

#### E2E Test 4: Multiple Websites
- [ ] Create notebook with multiple URLs
- [ ] Verify all process correctly
- [ ] Check consolidated metadata

### Quality Comparison

#### Side-by-Side Test
1. Create identical notebook with flag OFF (n8n)
2. Create identical notebook with flag ON (code)
3. Compare:
   - [ ] Title quality similar or better
   - [ ] Summary quality similar or better
   - [ ] Icon appropriate
   - [ ] Color appropriate
   - [ ] Example questions relevant and useful

---

## Phase 5: Performance & Monitoring

### Metrics to Track
- [ ] Average response time (should be faster)
- [ ] Error rate (should be same or lower)
- [ ] Success rate (should be 95%+)
- [ ] OpenAI API costs
- [ ] User complaints/feedback

### Monitoring Tasks
- [ ] Monitor logs for 1 hour after switch
- [ ] Check every 6 hours for first 24 hours
- [ ] Daily check for first week
- [ ] Review error logs daily

### Load Testing (Optional)
- [ ] Create 10 notebooks in quick succession
- [ ] Verify all process correctly
- [ ] Check for rate limiting issues
- [ ] Monitor OpenAI API usage

---

## Phase 6: Rollback Test

### Verify Rollback Works

#### Rollback Procedure
- [ ] Go to Supabase Dashboard
- [ ] Change `USE_CODE_BASED_GENERATOR` back to `false`
- [ ] Save
- [ ] Wait 30 seconds

#### Post-Rollback Verification
- [ ] Create test notebook
- [ ] Verify uses n8n webhook
- [ ] Check logs show: "⚠️  Using OLD n8n webhook"
- [ ] System works normally

#### Switch Back
- [ ] Change flag back to `true`
- [ ] Verify switches back to code-based
- [ ] Confirm works correctly

**Result:** Rollback mechanism verified working!

---

## Phase 7: Long-term Validation

### Week 1 Checks
- [ ] Day 1: Monitor closely for errors
- [ ] Day 2: Check error rates vs baseline
- [ ] Day 3: Review user feedback
- [ ] Day 4: Compare costs
- [ ] Day 5: Check performance metrics
- [ ] Day 6-7: Monitor for edge cases

### Week 2-4 Checks
- [ ] Weekly review of error logs
- [ ] Weekly cost comparison
- [ ] User feedback review
- [ ] Performance trends

### Success Criteria
- [ ] Error rate < 5%
- [ ] No critical bugs reported
- [ ] User feedback neutral or positive
- [ ] Costs similar or lower than n8n
- [ ] Response time faster than n8n
- [ ] Ready to deprecate n8n workflow

---

## Rollback Decision Points

### Rollback immediately if:
- [ ] Error rate > 25%
- [ ] Critical functionality broken
- [ ] Users unable to create notebooks
- [ ] OpenAI API completely down
- [ ] Data corruption occurring

### Consider rollback if:
- [ ] Error rate 10-25%
- [ ] Quality degradation reported
- [ ] Costs significantly higher
- [ ] Performance slower than n8n

### Safe to continue if:
- [ ] Error rate < 10%
- [ ] Quality same or better
- [ ] Costs same or lower
- [ ] No critical bugs
- [ ] User feedback positive

---

## Sign-off Checklist

Before declaring success:
- [ ] All tests passed
- [ ] Monitoring in place
- [ ] Rollback tested and working
- [ ] Documentation complete
- [ ] Team trained on feature flag
- [ ] Incident response plan documented
- [ ] 30 days of stable operation
- [ ] Ready to deprecate n8n workflow

---

## Notes & Observations

### Issues Found:
_Document any issues here_

### Performance Notes:
_Document performance observations_

### User Feedback:
_Document user feedback_

### Cost Analysis:
_Compare costs before/after_

---

**Remember:** The feature flag is your safety net. Don't hesitate to toggle back to n8n if something doesn't feel right!
