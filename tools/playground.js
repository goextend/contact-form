import jQuery from 'jquery';
import contactForm from '../src/contact-form';

const $ = jQuery;
const ContactForm = contactForm.ContactForm;

$('#show-modal').click(() => {
  const contactFormInstance = new ContactForm();
  contactFormInstance.show();
});

$('#show-support-modal').click(() => {
  const options = {
    modalTitle: 'Submit a Support Ticket',
    support: true
  };

  const contactFormInstance = new ContactForm(options);
  contactFormInstance.show();
});
