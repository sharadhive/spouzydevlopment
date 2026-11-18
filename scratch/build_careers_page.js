const fs = require('fs');

// Read join-doctor.htm to extract shared topbar, header, footer, search modal, drawer, floating widget, and scripts
const docHtml = fs.readFileSync('join-doctor.htm', 'utf8');

// Header part: from <!doctype html> up to </header>\n    </div>
const headerEndMarker = '</header>\n    </div>';
const headerIndex = docHtml.indexOf(headerEndMarker);
if (headerIndex === -1) {
  throw new Error('Header marker not found in join-doctor.htm');
}
let headerPart = docHtml.substring(0, headerIndex + headerEndMarker.length);

// Adjust title, meta description, and body class
headerPart = headerPart.replace(
  /<title>.*?<\/title>/,
  '<title>Careers at SPOUZY | Problem Solver Group (PSG)</title>'
);
headerPart = headerPart.replace(
  /<meta name="description" content=".*?">/,
  '<meta name="description" content="Explore career opportunities at SPOUZY in sales coordination, digital marketing, and performance marketing. Join India’s leading relationship and healthcare network.">'
);
headerPart = headerPart.replace(
  /<meta name="keywords" content=".*?">/,
  '<meta name="keywords" content="SPOUZY careers, jobs at SPOUZY, Sales Coordinator jobs, Digital Marketing Executive, Performance Marketing Specialist, healthcare jobs Mumbai, relationship counselling careers">'
);
headerPart = headerPart.replace(
  '<body class="sp-modern-wrapper spouzy-registration-page">',
  '<body class="sp-modern-wrapper spouzy-careers-page">'
);

// Footer part: from <footer class="sp-footer-modern" to end of file
const footerStartMarker = '<footer class="sp-footer-modern"';
const footerIndex = docHtml.indexOf(footerStartMarker);
if (footerIndex === -1) {
  throw new Error('Footer marker not found in join-doctor.htm');
}
const footerPart = docHtml.substring(footerIndex);

// Define the Careers main content and review modal
const careersBody = `
    <!-- MAIN CAREERS CONTENT CONTAINER (~1120px Centred) -->
    <main class="sp-careers-container" id="main-content" role="main">

        <!-- 1. Introduction Header -->
        <header class="sp-careers-intro-header">
            <nav class="sp-careers-breadcrumbs" aria-label="Breadcrumb navigation">
                <a href="index.htm">Home</a>
                <span class="sp-careers-bc-sep" aria-hidden="true">›</span>
                <span>Join Our Team</span>
                <span class="sp-careers-bc-sep" aria-hidden="true">›</span>
                <span aria-current="page">Careers</span>
            </nav>
            <h1 class="sp-careers-main-title">Build Your Career with SPOUZY</h1>
            <p class="sp-careers-intro-desc">
                Explore opportunities in sales coordination, digital marketing, and performance marketing. Help people discover SPOUZY’s services through clear communication, thoughtful campaigns, and organised support.
            </p>
            <a href="#openings" class="sp-careers-view-openings-btn">View Openings <span aria-hidden="true">↓</span></a>
        </header>

        <!-- 2. Current Openings Section -->
        <section class="sp-careers-openings-section" id="openings" aria-labelledby="openings-heading">
            <h2 class="sp-careers-section-heading" id="openings-heading">Current Openings</h2>
            <p class="sp-careers-section-sub">Join our multidisciplinary team dedicated to empathetic relationship wellness and healthcare clarity.</p>

            <!-- Role A: Sales Coordinator -->
            <article class="sp-job-card" id="role-sales-coordinator">
                <div class="sp-job-card-header">
                    <div>
                        <span class="sp-job-dept-badge">Sales &amp; Client Coordination</span>
                        <h3 class="sp-job-card-title">Sales Coordinator</h3>
                    </div>
                </div>
                <p class="sp-job-card-summary">
                    Coordinate incoming enquiries, organise follow-ups, and ensure every client receives timely, clear, and reassuring guidance.
                </p>
                <div class="sp-job-card-actions">
                    <button type="button" class="sp-role-toggle-btn" aria-expanded="false" aria-controls="details-sales-coordinator">
                        <span class="sp-toggle-text">View Role Details</span> <span class="sp-chevron" aria-hidden="true">▼</span>
                    </button>
                    <a href="#spCareersFormContainer" class="sp-role-apply-btn" data-role-select="Sales Coordinator">
                        Apply Now <span aria-hidden="true">→</span>
                    </a>
                </div>

                <div class="sp-role-detail-panel" id="details-sales-coordinator" hidden>
                    <h4 class="sp-role-subheading"><i class="fa fa-tasks" aria-hidden="true"></i> Key Responsibilities</h4>
                    <ul class="sp-role-list">
                        <li>Handle phone, email, and WhatsApp enquiries with discretion and professional warmth.</li>
                        <li>Schedule consultations, follow-ups, and appointments across our care network.</li>
                        <li>Maintain accurate client interaction records and CRM notes.</li>
                        <li>Liaise between clients, counsellors, and senior staff to ensure smooth service delivery.</li>
                        <li>Follow up with prospective clients who requested information or missed scheduled slots.</li>
                        <li>Prepare weekly summary reports on enquiry volumes, conversion, and common client queries.</li>
                    </ul>

                    <h4 class="sp-role-subheading"><i class="fa fa-check-circle-o" aria-hidden="true"></i> Required Skills &amp; Qualities</h4>
                    <ul class="sp-role-list">
                        <li>Excellent spoken and written English and Hindi communication.</li>
                        <li>Empathetic telephone manner and strong active-listening ability.</li>
                        <li>Good organisational skills with attention to detail and confidential record handling.</li>
                        <li>Familiarity with basic CRM tools, spreadsheets, and email suites.</li>
                        <li>High emotional intelligence when interacting with clients facing sensitive relationship challenges.</li>
                    </ul>

                    <h4 class="sp-role-subheading"><i class="fa fa-star-o" aria-hidden="true"></i> Preferred Background</h4>
                    <ul class="sp-role-list">
                        <li>Prior experience in client coordination, front-desk, hospitality, or healthcare customer care.</li>
                        <li>Comfort with multi-channel communication (voice, chat, email).</li>
                    </ul>

                    <div class="sp-role-terms-notice">
                        <i class="fa fa-info-circle" aria-hidden="true"></i>
                        <span>Compensation and employment terms are discussed during the selection process.</span>
                    </div>
                </div>
            </article>

            <!-- Role B: Digital Marketing Executive -->
            <article class="sp-job-card" id="role-digital-marketing">
                <div class="sp-job-card-header">
                    <div>
                        <span class="sp-job-dept-badge">Marketing</span>
                        <h3 class="sp-job-card-title">Digital Marketing Executive</h3>
                    </div>
                </div>
                <p class="sp-job-card-summary">
                    Plan, create, and publish educational content across digital channels, maintaining SPOUZY’s discreet, authoritative, and compassionate voice.
                </p>
                <div class="sp-job-card-actions">
                    <button type="button" class="sp-role-toggle-btn" aria-expanded="false" aria-controls="details-digital-marketing">
                        <span class="sp-toggle-text">View Role Details</span> <span class="sp-chevron" aria-hidden="true">▼</span>
                    </button>
                    <a href="#spCareersFormContainer" class="sp-role-apply-btn" data-role-select="Digital Marketing Executive">
                        Apply Now <span aria-hidden="true">→</span>
                    </a>
                </div>

                <div class="sp-role-detail-panel" id="details-digital-marketing" hidden>
                    <h4 class="sp-role-subheading"><i class="fa fa-tasks" aria-hidden="true"></i> Key Responsibilities</h4>
                    <ul class="sp-role-list">
                        <li>Draft and schedule social media posts, blog snippets, and newsletter content aligned with SPOUZY’s values.</li>
                        <li>Coordinate graphic design and short-form video assets with external or internal creatives.</li>
                        <li>Monitor audience engagement, comments, and messages with professional boundaries and prompt escalation where needed.</li>
                        <li>Assist with on-page SEO updates, meta tags, and content refreshes across the SPOUZY website.</li>
                        <li>Track basic organic traffic and engagement metrics to report on campaign performance.</li>
                        <li>Ensure all marketing communications comply with healthcare discretion and confidentiality standards.</li>
                    </ul>

                    <h4 class="sp-role-subheading"><i class="fa fa-check-circle-o" aria-hidden="true"></i> Required Skills &amp; Qualities</h4>
                    <ul class="sp-role-list">
                        <li>Strong written communication with a sensitive, refined, and non-sensational tone.</li>
                        <li>Familiarity with major social media platforms (Instagram, LinkedIn, YouTube, Facebook).</li>
                        <li>Working knowledge of Canva, basic photo/video editing tools, and content scheduling platforms.</li>
                        <li>Understanding of fundamental SEO principles and content management systems.</li>
                        <li>Respect for confidential healthcare and relationship wellness topics.</li>
                    </ul>

                    <h4 class="sp-role-subheading"><i class="fa fa-star-o" aria-hidden="true"></i> Preferred Background</h4>
                    <ul class="sp-role-list">
                        <li>Experience in content marketing, social media management, or copywriting for wellness, healthcare, or professional services.</li>
                        <li>Basic understanding of Google Analytics and Search Console.</li>
                    </ul>

                    <div class="sp-role-terms-notice">
                        <i class="fa fa-info-circle" aria-hidden="true"></i>
                        <span>Compensation and employment terms are discussed during the selection process.</span>
                    </div>
                </div>
            </article>

            <!-- Role C: Performance Marketing Specialist -->
            <article class="sp-job-card" id="role-performance-marketing">
                <div class="sp-job-card-header">
                    <div>
                        <span class="sp-job-dept-badge">Growth &amp; Paid Media</span>
                        <h3 class="sp-job-card-title">Performance Marketing Specialist</h3>
                    </div>
                </div>
                <p class="sp-job-card-summary">
                    Manage paid search and social campaigns to connect individuals and couples with the guidance and clinical care they need.
                </p>
                <div class="sp-job-card-actions">
                    <button type="button" class="sp-role-toggle-btn" aria-expanded="false" aria-controls="details-performance-marketing">
                        <span class="sp-toggle-text">View Role Details</span> <span class="sp-chevron" aria-hidden="true">▼</span>
                    </button>
                    <a href="#spCareersFormContainer" class="sp-role-apply-btn" data-role-select="Performance Marketing Specialist">
                        Apply Now <span aria-hidden="true">→</span>
                    </a>
                </div>

                <div class="sp-role-detail-panel" id="details-performance-marketing" hidden>
                    <h4 class="sp-role-subheading"><i class="fa fa-tasks" aria-hidden="true"></i> Key Responsibilities</h4>
                    <ul class="sp-role-list">
                        <li>Build, monitor, and optimise paid advertising campaigns on Google Ads (Search, Display) and Meta (Facebook &amp; Instagram).</li>
                        <li>Conduct keyword research, competitive analysis, and ad copy testing focused on high-intent healthcare and relationship queries.</li>
                        <li>Manage campaign budgets responsibly, tracking cost-per-lead (CPL) and return on ad spend (ROAS).</li>
                        <li>Collaborate on landing page conversion rate optimisation (CRO) and user journey improvements.</li>
                        <li>Set up and audit conversion tracking, tags, and analytics events via Google Tag Manager and GA4.</li>
                        <li>Deliver transparent weekly and monthly performance reports with actionable optimisation insights.</li>
                    </ul>

                    <h4 class="sp-role-subheading"><i class="fa fa-check-circle-o" aria-hidden="true"></i> Required Skills &amp; Qualities</h4>
                    <ul class="sp-role-list">
                        <li>Demonstrated hands-on experience managing Google Ads and Meta Ads campaigns.</li>
                        <li>Strong analytical mindset with proficiency in spreadsheets and data visualisation.</li>
                        <li>In-depth understanding of ad policies regarding health, medical, and sensitive personal topics.</li>
                        <li>Knowledge of conversion tracking, UTM tagging, and attribution models.</li>
                        <li>Disciplined budget management and continuous A/B testing methodology.</li>
                    </ul>

                    <h4 class="sp-role-subheading"><i class="fa fa-star-o" aria-hidden="true"></i> Preferred Background</h4>
                    <ul class="sp-role-list">
                        <li>Prior experience driving qualified leads for healthcare clinics, mental wellness platforms, or professional consultancies.</li>
                        <li>Google Ads or Meta Blueprint certifications are an advantage.</li>
                    </ul>

                    <div class="sp-role-terms-notice">
                        <i class="fa fa-info-circle" aria-hidden="true"></i>
                        <span>Compensation and employment terms are discussed during the selection process.</span>
                    </div>
                </div>
            </article>
        </section>

        <!-- 3. Recruitment Process Section -->
        <section class="sp-recruitment-process-section" aria-labelledby="process-heading">
            <h2 class="sp-careers-section-heading" id="process-heading">Our Recruitment Process</h2>
            <p class="sp-careers-section-sub">A transparent and respectful four-step evaluation sequence designed to ensure a mutual fit.</p>

            <div class="sp-process-grid">
                <div class="sp-process-card">
                    <div class="sp-process-step-num">1</div>
                    <h3 class="sp-process-step-title">Send Application</h3>
                    <p class="sp-process-step-desc">Select your desired role, share your background details, and attach your resume.</p>
                </div>

                <div class="sp-process-card">
                    <div class="sp-process-step-num">2</div>
                    <h3 class="sp-process-step-title">Profile Review</h3>
                    <p class="sp-process-step-desc">Our team carefully reviews your qualifications, communication strengths, and alignment with SPOUZY values.</p>
                </div>

                <div class="sp-process-card">
                    <div class="sp-process-step-num">3</div>
                    <h3 class="sp-process-step-title">Role Discussion</h3>
                    <p class="sp-process-step-desc">If shortlisted, participate in a focused discussion covering skills, experience, and mutual expectations.</p>
                </div>

                <div class="sp-process-card">
                    <div class="sp-process-step-num">4</div>
                    <h3 class="sp-process-step-title">Outcome Communicated</h3>
                    <p class="sp-process-step-desc">A clear and respectful decision is communicated by our coordination desk.</p>
                </div>
            </div>
        </section>

        <!-- 4. Application Form Section -->
        <section class="sp-careers-form-section" id="spCareersFormContainer" aria-labelledby="form-heading">
            <div class="sp-careers-form-card">
                <h2 class="sp-careers-section-heading" id="form-heading">Submit Your Application</h2>
                <p class="sp-careers-section-sub">Complete each section below to review your information and prepare your application for WhatsApp handoff.</p>

                <!-- Validation Error Banner -->
                <div class="sp-form-validation-banner" id="spCareerFormError" role="alert"></div>

                <form id="spCareersForm" novalidate>
                    <div class="sp-careers-form-grid">
                        
                        <!-- Role Selection -->
                        <div class="sp-career-field-group sp-career-col-span-2">
                            <label class="sp-career-field-label" for="spCareerRole">
                                Applying For Position <span class="sp-req-star">*</span>
                            </label>
                            <select id="spCareerRole" class="sp-career-select" required>
                                <option value="">-- Please select an open position --</option>
                                <option value="Sales Coordinator">Sales Coordinator (Sales &amp; Client Coordination)</option>
                                <option value="Digital Marketing Executive">Digital Marketing Executive (Marketing)</option>
                                <option value="Performance Marketing Specialist">Performance Marketing Specialist (Growth &amp; Paid Media)</option>
                            </select>
                        </div>

                        <!-- Full Name -->
                        <div class="sp-career-field-group">
                            <label class="sp-career-field-label" for="spCareerFullName">
                                Full Name <span class="sp-req-star">*</span>
                            </label>
                            <input type="text" id="spCareerFullName" class="sp-career-input" placeholder="e.g. Priya Sharma" required>
                        </div>

                        <!-- Email Address -->
                        <div class="sp-career-field-group">
                            <label class="sp-career-field-label" for="spCareerEmail">
                                Email Address <span class="sp-req-star">*</span>
                            </label>
                            <input type="email" id="spCareerEmail" class="sp-career-input" placeholder="e.g. priya@example.com" required>
                        </div>

                        <!-- Mobile Number -->
                        <div class="sp-career-field-group">
                            <label class="sp-career-field-label" for="spCareerMobile">
                                Mobile Number <span class="sp-req-star">*</span>
                            </label>
                            <div class="sp-phone-combo">
                                <select id="spCareerMobileCode" class="sp-career-select sp-phone-code-select" aria-label="Country Code">
                                    <option value="+91" selected>+91 (IN)</option>
                                    <option value="+1">+1 (US/CA)</option>
                                    <option value="+44">+44 (UK)</option>
                                    <option value="+971">+971 (UAE)</option>
                                    <option value="+65">+65 (SG)</option>
                                    <option value="+61">+61 (AU)</option>
                                </select>
                                <input type="tel" id="spCareerMobile" class="sp-career-input" placeholder="10-digit mobile number" required>
                            </div>
                        </div>

                        <!-- WhatsApp Number -->
                        <div class="sp-career-field-group">
                            <label class="sp-career-field-label" for="spCareerWhatsapp">
                                WhatsApp Number <span class="sp-req-star">*</span>
                            </label>
                            <div class="sp-phone-combo">
                                <select id="spCareerWaCode" class="sp-career-select sp-phone-code-select" aria-label="WhatsApp Country Code">
                                    <option value="+91" selected>+91 (IN)</option>
                                    <option value="+1">+1 (US/CA)</option>
                                    <option value="+44">+44 (UK)</option>
                                    <option value="+971">+971 (UAE)</option>
                                    <option value="+65">+65 (SG)</option>
                                    <option value="+61">+61 (AU)</option>
                                </select>
                                <input type="tel" id="spCareerWhatsapp" class="sp-career-input" placeholder="10-digit WhatsApp number" required>
                            </div>
                            <label class="sp-career-checkbox-label">
                                <input type="checkbox" id="spCareerSameAsMobile">
                                <span>Same as mobile number</span>
                            </label>
                        </div>

                        <!-- Current City -->
                        <div class="sp-career-field-group">
                            <label class="sp-career-field-label" for="spCareerCity">
                                Current City <span class="sp-req-star">*</span>
                            </label>
                            <input type="text" id="spCareerCity" class="sp-career-input" placeholder="e.g. Mumbai, Pune, Delhi NCR, Bengaluru" required>
                        </div>

                        <!-- Total Relevant Experience -->
                        <div class="sp-career-field-group">
                            <label class="sp-career-field-label" for="spCareerExp">
                                Total Relevant Experience <span class="sp-req-star">*</span>
                            </label>
                            <select id="spCareerExp" class="sp-career-select" required>
                                <option value="">-- Select experience level --</option>
                                <option value="Fresher / 0 years (Entry Level)">Fresher / 0 years (Entry Level)</option>
                                <option value="Less than 1 year">Less than 1 year</option>
                                <option value="1 - 2 years">1 - 2 years</option>
                                <option value="2 - 4 years">2 - 4 years</option>
                                <option value="4 - 6 years">4 - 6 years</option>
                                <option value="6+ years">6+ years</option>
                            </select>
                        </div>

                        <!-- Current / Most Recent Job Title (Optional) -->
                        <div class="sp-career-field-group">
                            <label class="sp-career-field-label" for="spCareerCurrentRole">
                                Current / Most Recent Job Title <span class="sp-optional-tag">(Optional)</span>
                            </label>
                            <input type="text" id="spCareerCurrentRole" class="sp-career-input" placeholder="e.g. Customer Care Executive / Student">
                        </div>

                        <!-- Highest Qualification (Optional) -->
                        <div class="sp-career-field-group">
                            <label class="sp-career-field-label" for="spCareerHighestQual">
                                Highest Qualification <span class="sp-optional-tag">(Optional)</span>
                            </label>
                            <input type="text" id="spCareerHighestQual" class="sp-career-input" placeholder="e.g. Bachelor's in Arts / BBA / MBA">
                        </div>

                        <!-- Relevant Skills & Strengths -->
                        <div class="sp-career-field-group sp-career-col-span-2">
                            <label class="sp-career-field-label" for="spCareerSkills">
                                Key Skills &amp; Strengths <span class="sp-req-star">*</span>
                            </label>
                            <textarea id="spCareerSkills" class="sp-career-textarea" rows="3" placeholder="Highlight relevant skills, software, language fluency, or domain knowledge..." required></textarea>
                            <span class="sp-career-helper-text">e.g. Fluency in Hindi &amp; English, CRM handling, empathetic telephone manner, Canva, Google Ads...</span>
                        </div>

                        <!-- Portfolio / LinkedIn URL (Optional) -->
                        <div class="sp-career-field-group">
                            <label class="sp-career-field-label" for="spCareerPortfolio">
                                LinkedIn Profile / Portfolio URL <span class="sp-optional-tag">(Optional)</span>
                            </label>
                            <input type="url" id="spCareerPortfolio" class="sp-career-input" placeholder="https://www.linkedin.com/in/username">
                        </div>

                        <!-- Notice Period / Availability -->
                        <div class="sp-career-field-group">
                            <label class="sp-career-field-label" for="spCareerNotice">
                                Notice Period / Availability <span class="sp-req-star">*</span>
                            </label>
                            <select id="spCareerNotice" class="sp-career-select" required>
                                <option value="">-- Select availability --</option>
                                <option value="Immediate">Immediate</option>
                                <option value="15 Days">15 Days</option>
                                <option value="1 Month">1 Month</option>
                                <option value="2 Months">2 Months</option>
                                <option value="3 Months">3 Months</option>
                                <option value="Flexible / Discuss during interview">Flexible / Discuss during interview</option>
                            </select>
                        </div>

                        <!-- Expected Compensation (Optional) -->
                        <div class="sp-career-field-group sp-career-col-span-2">
                            <label class="sp-career-field-label" for="spCareerExpectedComp">
                                Expected Compensation <span class="sp-optional-tag">(Optional)</span>
                            </label>
                            <input type="text" id="spCareerExpectedComp" class="sp-career-input" placeholder="e.g. As per industry standards / Negotiable">
                            <span class="sp-career-helper-text">Compensation terms will be discussed openly during the selection process.</span>
                        </div>

                        <!-- Why SPOUZY -->
                        <div class="sp-career-field-group sp-career-col-span-2">
                            <label class="sp-career-field-label" for="spCareerWhy">
                                Why would you like to join SPOUZY? <span class="sp-req-star">*</span>
                            </label>
                            <textarea id="spCareerWhy" class="sp-career-textarea" rows="4" placeholder="Briefly share what resonates with you about SPOUZY's mission and how this role fits your career..." required></textarea>
                            <span class="sp-career-helper-text">Minimum 20 characters.</span>
                        </div>

                        <!-- Resume Upload -->
                        <div class="sp-career-field-group sp-career-col-span-2">
                            <label class="sp-career-field-label" id="resume-label">
                                Resume Attachment <span class="sp-req-star">*</span>
                            </label>
                            
                            <!-- Dropzone -->
                            <div class="sp-career-dropzone" id="spResumeDropzone" tabindex="0" role="button" aria-labelledby="resume-label">
                                <i class="fa fa-cloud-upload" aria-hidden="true"></i>
                                <div class="sp-dropzone-prompt">Click to select or drag and drop your resume</div>
                                <div class="sp-dropzone-sub">PDF, DOC, or DOCX formats accepted (up to 10 MB)</div>
                            </div>
                            <input type="file" id="spResumeInput" accept=".pdf,.doc,.docx" style="display:none;" aria-label="Upload Resume">

                            <!-- File Preview Card (Hidden initially) -->
                            <div class="sp-file-preview-card" id="spResumePreviewCard" style="display:none;">
                                <div class="sp-file-info">
                                    <div class="sp-file-thumb"></div>
                                    <div class="sp-file-meta">
                                        <div class="sp-file-name"></div>
                                        <div class="sp-file-size"></div>
                                    </div>
                                </div>
                                <div class="sp-file-actions">
                                    <button type="button" class="sp-file-btn" id="spReplaceResumeBtn">Replace</button>
                                    <button type="button" class="sp-file-btn sp-file-btn-remove" id="spRemoveResumeBtn">Remove</button>
                                </div>
                            </div>

                            <!-- Inline error for resume -->
                            <div class="sp-inline-error" id="spResumeError" role="alert"></div>
                        </div>

                        <!-- Consent Checkbox -->
                        <div class="sp-career-field-group sp-career-col-span-2">
                            <label class="sp-career-checkbox-label">
                                <input type="checkbox" id="spCareerConsent" required>
                                <span>I confirm that all information provided is accurate and agree to SPOUZY reviewing my details in accordance with the <a href="privacy-policy.htm" target="_blank" rel="noopener">Privacy Policy</a>. <span class="sp-req-star">*</span></span>
                            </label>
                        </div>

                        <!-- Submit Action -->
                        <div class="sp-career-col-span-2" style="margin-top: 10px;">
                            <button type="submit" class="sp-career-submit-btn">
                                <i class="fa fa-file-text-o" aria-hidden="true"></i> Review Application
                            </button>
                        </div>

                    </div>
                </form>
            </div>
        </section>

    </main>

    <!-- 5. APPLICATION REVIEW MODAL -->
    <div class="sp-review-modal" id="spCareerReviewModal" role="dialog" aria-modal="true" aria-labelledby="careerReviewHeading" style="display:none;">
        <div class="sp-review-card">
            <div class="sp-review-header">
                <div>
                    <h3 class="sp-review-title" id="careerReviewHeading">Review Your Application</h3>
                    <p class="sp-review-sub">Please verify your details before continuing to WhatsApp review with our team.</p>
                </div>
                <button type="button" class="sp-review-close-btn" id="spCareerReviewCloseBtn" aria-label="Close review modal">&times;</button>
            </div>

            <div class="sp-review-body" id="spCareerReviewContent">
                <!-- Dynamically populated by JS -->
            </div>

            <div class="sp-review-footer">
                <button type="button" class="sp-review-edit-btn" id="spCareerReviewEditBtn">Edit Details</button>
                <button type="button" class="sp-form-copy-btn" id="spCareerCopyTextBtn">
                    <i class="fa fa-clone" aria-hidden="true"></i> Copy Application Text
                </button>
                <button type="button" class="sp-review-whatsapp-btn" id="spCareerReviewWhatsappBtn">
                    <i class="fa fa-whatsapp" aria-hidden="true"></i> Continue on WhatsApp ↗
                </button>
            </div>
        </div>
    </div>
`;

// Assemble the complete careers.htm file
const fullHtml = headerPart + '\n' + careersBody + '\n' + footerPart;

fs.writeFileSync('careers.htm', fullHtml, 'utf8');
console.log('Successfully created careers.htm with ' + fullHtml.length + ' bytes.');
