%% Script for Generating Data from AWGN for Amorgos IC

tic;
clc;
clear
close all

%% Set up test vectors and LDPC settings

S3=load('./MacKay_96_3_963.mat','ethernet');
ethernet=S3.ethernet;

% Load H matrix
H=ethernet.H';          
[eqns,n]=size(H);

% Set-Up AWGN channel:

%SNR = 3.0:0.5:6;
SNR=1:1:2;                         % SNR Range
sigma = 1./sqrt(SNR);

test_l=76800;                        % number of test vectors per SNR step
SNR_l=length(SNR);                  % number of SNR steps

load("codes1-10.mat") 
zerocode=0;                         % 0 if all zero word, 1 for nonzero word (loaded)
code_sel=2;                         % select non zero receive word

if zerocode==0
    RX_id=zeros(SNR_l,test_l,n);    % ideal zero word
else
    for i=1:SNR_l
        for j=1:test_l
            if co
            RX_id(i,j,:)=coded_sig(code_sel,:);     % ideal nonzero word
        end
    end
    end
end


RX_mod=(RX_id.*-2)+1;           % BPSK modulated vectors
RX_ideal=zeros(n,1);

c = [-1 1];
sigpower = pow2db(mean(abs(c).^2));

% channel outputs
for i=1:SNR_l
    for j=1:test_l
        RX_chn(i,j,:)=awgn(RX_mod(i,j,:),SNR(i),sigpower);
    end
    % calculate noise power for referenece:
    noise=RX_chn(i,j,:)-RX_mod;
    ntemp=reshape(noise(1,1,:),[1 n]);
    noisepower=pow2db(mean(abs(ntemp).^2))
end

% hard decision initialization:
for i=1:SNR_l
    RX_rec(i,:,:)=RX_chn(i,:,:).*2/sigma(i)^2;          % scale to received LLR
    for j=1:test_l
        RX_hard(i,j,:)=(sign(RX_chn(i,j,:))-1)/-2;
        res(i+j-1)=n-sum(RX_hard(i,j,:)==zeros(1,1,n));
        RX_hard_err(i,j,:)=not((RX_hard(i,j,:)==RX_id(1,1,:)));
    end
end


figure
plot(reshape(RX_hard_err(1,1,:),[1 n]))
title('Hard decision errors (first received word) after received LLR')

%% Set up osc array

% set inital voltage of osc-array
osc_init=zeros(SNR_l,test_l,n);
for i=1:SNR_l
    for j=1:test_l
        for k=1:n
            llr=RX_chn(i,j,k);                     % used RX_chn before
            llrabs=abs(llr);            
            % 3-bit DAC
            
            div=1;
            if llrabs<=div
                step=1/8;
                llr=llrabs/div;                     % scaling llr / by 1 now                           
                tmpv=0.5-0.5*llr;                   % max DAC val = 0.5 now
                quant=floor(tmpv/step);             % ADC conv       
                osc_init(i,j,k)=quant*step;         % init values
                osc_init_q(i,j,k)=quant;            % DAC init value
                if llr<0
                    %RX_hard(i,j,k)=not(RX_hard(i,j,k));
                    %osc_init(i,j,k)=1-osc_init(i,j,k);
                    %osc_init(i,j,k)=1-llrabs;
                    %osc_init(i,j,k)=0;
                end
            else
                osc_init_q(i,j,k)=0;
            end
        end
    end
end

DAC_bits=zeros(SNR_l,test_l,4*n);
% save DAC init values:
for i=1:SNR_l
    for j=1:test_l
        for k=1:n
            binv=de2bi(osc_init_q(i,j,k),3);
            binv=not(binv);
            oscv=RX_hard(i,j,k);
            DAC_bits(i,j,(k-1)*4+1)=binv(1);
            DAC_bits(i,j,(k-1)*4+2)=binv(2);
            DAC_bits(i,j,(k-1)*4+3)=binv(3);
            DAC_bits(i,j,(k-1)*4+4)=oscv;
        end
    end
end

RX_recc_h=reshape(RX_hard(1,1,:),[1 n]);
reshape(RX_chn(1,1,:),[1 n]);
osc_v=reshape(osc_init(1,1,:),[1 n]);
find(RX_recc_h>0);

% save dac bits for file FOR TESTING
SOFT_INFO_save_testing(DAC_bits,SNR)
