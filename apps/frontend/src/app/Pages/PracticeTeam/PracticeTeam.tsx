'use client';
import React, {useCallback, useState } from 'react';
import { Button, Container ,Form,Modal, ModalProps } from 'react-bootstrap';
import "./PracticeTeam.css"
import { PiFileArrowDownFill } from 'react-icons/pi';
import { IoIosArrowDropleft } from 'react-icons/io';
import { FaCircleCheck} from 'react-icons/fa6';
import Header from '@/app/Components/Header/Header';
import DynamicSelect from '@/app/Components/DynamicSelect/DynamicSelect';
import { FormInput } from '../Sign/SignUp';
import { IoAddCircle } from 'react-icons/io5';
import { MdDeleteForever } from 'react-icons/md';
import { Omit, BsPrefixProps } from 'react-bootstrap/esm/helpers';
import { RiUploadCloud2Fill } from 'react-icons/ri';
import { LiaTimesCircle } from 'react-icons/lia';
import { HiDocumentArrowDown } from 'react-icons/hi2';


// Bulk Invite PopUp Started 
function BulkInviteModal(props: React.JSX.IntrinsicAttributes & Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, BsPrefixProps<"div"> & ModalProps> & BsPrefixProps<"div"> & ModalProps & { children?: React.ReactNode | undefined; }) {
  return (
    <Modal {...props} className='BulkInviteModalSec' aria-labelledby="contained-modal-title-vcenter" centered >
      <Modal.Body>
        <div className="BulkInviteBody">
            <div className="BulkHeader">
                <h3>Bulk Invite Team Members</h3>
                <p>Upload a CSV file with details to invite multiple team members at once</p>
            </div>
            <div className="BulkMidContent">
                <div className="Step1">
                    <div className="Step1Hed">
                        <h6>Step 01</h6>
                        <Form.Check  type="checkbox" />
                    </div>
                    <div className="StepDownlde">
                        <div className="lftText">
                            <h4>Download the sample CSV</h4>
                            <p>Add your team data in the format given in the sample CSV</p>
                        </div>
                        <div className="RytDoct">
                            <HiDocumentArrowDown />
                        </div>
                    </div>
                </div>
                <div className="Step2">
                    <div className="Step2Hed">
                        <h6>Step 02</h6>
                    </div>
                    <div className="StepUplode">
                        <input type="file" id="img" name="img" accept="image/*"></input>
                        <div className="UplodeInner">
                            <RiUploadCloud2Fill />
                            <h4>Upload the CSV with your team member details</h4>
                            <p>Max size supported 20 MB</p>
                        </div>

                    </div>

                </div>
            </div>
            <div className="UpldBtn">
                <Button>Upload CSV</Button>
            </div>

        </div>

        <div className="CrossBtn">
            <Button onClick={props.onHide}><LiaTimesCircle/></Button>
        </div>
      </Modal.Body>
      
    </Modal>
  );
}
// Bulk Invite PopUp Ended 

function PracticeTeam() {
    const [modalShow, setModalShow] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true);
   const [country, setCountry] = useState<string>('');
  const [members, setMembers] = useState([
    { department: "", role: "", email: "" }
  ]);

  const [name, setName] = useState({
    emailadress: "",
  });
  const handleEmailAdress = useCallback((e: { target: { name: string; value: string; }; }) => {
      const { name, value } = e.target;
      setName((prevData) => ({
        ...prevData,
        [name]: value,
      }));
    }, []);


    // Country 
    type Option = {
    value: string;
    label: string;
    };
    const options: Option[] = [
        { value: 'us', label: '🇺🇸 United States' },
        { value: 'in', label: '🇮🇳 India' },
        { value: 'uk', label: '🇬🇧 United Kingdom' },
    ];
    // Country 


    // Add Member 

  const addMember = () => {
    setMembers(members => [...members, { department: "", role: "", email: "" }]);
  };

  const removeMember = (idx: number) => {
    setMembers(members => members.filter((_, i) => i !== idx));
  };

  const handleSendInvite = () => {
    // Implement your invite logic here
    alert(JSON.stringify(members, null, 2));
  };
  // Add Member 

  return (
    <>
      <Header isLoggedIn={isLoggedIn} />
      <section className='PracticeTeamSec'>
        <Container>
          <div className="PracticeTeamData">
            <div className="InviteContainer">
              <div className="InviteHeader">
                <h4>Invite <span>team member</span></h4>
                <Button className="ImportBtn"  onClick={() => setModalShow(true)}><PiFileArrowDownFill /> Bulk Invite</Button>
              </div>

              {/* Bulk Invite Modal */}
                 <BulkInviteModal show={modalShow}  onHide={() => setModalShow(false)}/>
                {/* Bulk Invite Modal */}
              <div className="InviteCard">
                <div className="InviteTeamData">
                    {members.map((member, idx) => (
                    <div key={idx} className="MemberFormBlock">
                        <div className="InviteTitleTrash">
                            <h2>{members.length > 1 ? ( <><span className="member-number">{(idx + 1).toString().padStart(2,     "0")}</span>. Add Member Details </>
                            ) : (
                                "Add Details"
                            )}
                            </h2>
                            {members.length > 1 && (
                            <Button variant="link"className="RemoveBtn"onClick={() => removeMember(idx)}tabIndex={-1}>
                                <MdDeleteForever /></Button>
                            )}
                        </div>
                        <DynamicSelect  options={options}  value={country} onChange={setCountry} inname="country" placeholder="Department" />
                        <DynamicSelect  options={options}  value={country} onChange={setCountry} inname="country" placeholder="Select Role" />
                        <FormInput intype="email" inname="emailadress" value={name.emailadress} inlabel="Email Address" onChange={handleEmailAdress} />
                    </div>
                    ))}
                    <div className="AddMemberDiv">
                        <Button onClick={addMember}> <IoAddCircle /> Add More Members</Button>
                        {members.length > 1 && (
                        <p> Inviting more than 10 members? <span>Use the Bulk Invite Option.</span></p>
                        )}
                    </div>
                </div>

                <div className="InviteFooter">
                  <Button className="BackBtn"><IoIosArrowDropleft /> Back</Button>
                  <Button className="SendBtn" onClick={handleSendInvite}><FaCircleCheck /> Send Invite</Button>
                </div>

              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

export default PracticeTeam;